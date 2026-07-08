import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-sketch";

import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';

import Graphic from '@arcgis/core/Graphic';
import Polygon from '@arcgis/core/geometry/Polygon';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import PolygonSymbol3D from '@arcgis/core/symbols/PolygonSymbol3D';
import ExtrudeSymbol3DLayer from '@arcgis/core/symbols/ExtrudeSymbol3DLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';

@Component({
  selector: 'app-root',
  imports: [CommonModule], 
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  mapComponent!: ArcgisMap;
  sceneComponent!: ArcgisScene;

  readonly DEFAULT_HEIGHT = 30;
  buildingHeight: number = 30;
  isBoxSelected: boolean = false;
  isDrawingComplete: boolean = false;
  activeGraphic: any = null;

  // สำหรับจดจำค่าก่อนทำการอัปเดต เพื่อย้อนกลับเมื่อผิดเงื่อนไข
  originalGeometry: any = null;
  originalHeight: number = 30;
  
  zonesData: any[] = []; // เก็บข้อมูล zone ที่ดึงมาจาก API
  parcelsData: any[] = []; // เก็บข้อมูล parcel ที่ดึงมาจาก API
  activeSpaceGlobalIDs: string[] = []; // เก็บ GlobalID ของ spaces ตอนคลิกเลือกตึก
  activeSpacesSignal = signal<any[]>([]); // Signal แบบ Global เอาไว้ใช้งานจาก Component หรือ Template ง่ายๆ
  
  graphicsLayer = new GraphicsLayer({
    elevationInfo: {
      mode: "on-the-ground"
    }
  });
  zoneGraphicsLayer = new GraphicsLayer({
    elevationInfo: {
      mode: "on-the-ground"
    }
  });
  parcelGraphicsLayer = new GraphicsLayer({
    elevationInfo: {
      mode: "on-the-ground"
    }
  });

  sketchViewModel!: SketchViewModel;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ){}
  
  updateHeight(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.buildingHeight = Number(inputElement.value) || 1;
    this.updateSketchSymbol(); // อัปเดตสำหรับตึกก้อนถัดไปที่จะวาดใหม่

    // อัปเดตความสูงของตึกที่ถูกคลิกเลือกอยู่ (ถ้ามี)
    if (this.activeGraphic) {
      this.activeGraphic.symbol = new PolygonSymbol3D({
        symbolLayers: [
          new ExtrudeSymbol3DLayer({
            size: this.buildingHeight,
            material: { color: "#ffffff" },
          })
        ]
      });
    }
  }

  addFloor() {
    console.log("=== Add Floor ===");
    console.log(this.activeSpacesSignal());
    
    // defined varialbles
    const graphicToUpdate = this.activeGraphic;
    const attr = this.activeSpacesSignal().at(-1).attributes;
    const geometry = this.activeSpacesSignal().at(-1).geometry;
    console.log("active graphic eiei", this.activeGraphic)
    const floorHeight = attr.FloorHeight;
    const floorNumber = attr.FloorNumber + 1;
    
    const rings3D = geometry.rings.map((ring: any[]) => 
      ring.map((pt: any[]) => pt.length === 3 ? [pt[0], pt[1], pt[2]+floorHeight] : pt)
    );

    // จำลองค่าจำนวนชั้นและความสูงใหม่ที่จะเกิดขึ้น เพื่อส่งไปเช็ค Regulation ก่อน
    const newNumFloors = this.activeSpacesSignal().length + 1;
    const newTotalHeight = this.buildingHeight + floorHeight;

    const checkResult = this.checkZoneRegulation(newNumFloors, newTotalHeight);

    if (checkResult!.status === "error"){
      alert(checkResult!.message);
      return; // ถ้ายอดเกิน ให้หยุดการทำงานทันที (ไม่สร้างชั้นใหม่)
    } else {
      alert(checkResult!.message);
      this.apiService.createSpace(rings3D, floorHeight, floorNumber).subscribe({
        next: (response) => {
          console.log("=== อัพเดตตึก LOD1 สำเร็จ! ===");
          console.log(response);

          const createdSpaces = response?.data?.createSpaces;
          if (createdSpaces && createdSpaces.length > 0) {
              // 1. ดึงชั้นเดิมมาประกอบกับชั้นใหม่
              const currentSpaces = this.activeSpacesSignal();
              const allSpaces = [...currentSpaces, ...createdSpaces];

              // 2. อัปเดตข้อมูลกลับไปที่ Graphic
              const allIDs = allSpaces.map((space: any) => space.attributes.GlobalID);
              if (!graphicToUpdate.attributes) graphicToUpdate.attributes = {};
              graphicToUpdate.attributes.spaceGlobalIDs = allIDs;
              graphicToUpdate.attributes.spacesData = allSpaces;
              this.activeSpacesSignal.set(allSpaces);

              // 3. อัปเดตความสูงของ Graphic (Visual Update) และ Input
              const numFloors = allSpaces.length;
              const totalHeight = floorHeight * numFloors;
              this.buildingHeight = totalHeight; // อัปเดตค่าใน input ทันที
              
              graphicToUpdate.symbol = new PolygonSymbol3D({
                symbolLayers: [
                  new ExtrudeSymbol3DLayer({
                    size: totalHeight,
                    material: { color: "#ffffff" },
                  })
                ]
              });
          }
        },
        error: (err) => {
          console.error("เกิดข้อผิดพลาดในการสร้างตึก:", err);
        }
      });
    }

    
    
  }

  removeFloor() {
    console.log("=== Remove Floor ===");
    console.log(this.activeSpacesSignal());
  }

  // อัปเดตสัญลักษณ์เวลาเปลี่ยนความสูง
  updateSketchSymbol() {
    if (!this.sketchViewModel) return;
    
    this.sketchViewModel.polygonSymbol = new PolygonSymbol3D({
      symbolLayers: [
        new ExtrudeSymbol3DLayer({
          size: this.buildingHeight, // ความสูง
          material: { color: "#ffffff" } 
        })
      ]
    });
  }

  startDrawing() {
    this.updateSketchSymbol();
    // สั่งให้เริ่มวาดสี่เหลี่ยม
    this.sketchViewModel.create("rectangle");
  }

  clearGraphics() {
    this.graphicsLayer.removeAll();
    // this.zoneGraphicsLayer.removeAll();
  }

  checkZoneRegulation(simulatedNumFloors?: number, simulatedTotalHeight?: number) {
    if (!this.activeGraphic) return;
    
    const buildingGeometry = this.activeGraphic.geometry; 
    let isFullyInsideSomeZone = false;
    let isPartiallyIntersecting = false;
    let matchedZone = null;

    for (let zone of this.zonesData) {
        if (!zone.geometry || !zone.geometry.rings) continue;
        
        const zonePolygon = new Polygon({
            rings: zone.geometry.rings,
            spatialReference: zone.geometry.spatialReference
        });

        // 1. เช็คว่า "อยู่ข้างในโซนนี้แบบ 100%" หรือเปล่า?
        const isWithin = geometryEngine.within(buildingGeometry, zonePolygon);
        
        // 2. เช็คว่า "ทับซ้อนแค่บางส่วน" หรือเปล่า? (โดนแค่ขอบๆ หรือยื่นออกไปข้างนอก)
        const isIntersecting = geometryEngine.intersects(buildingGeometry, zonePolygon);

        if (isWithin) {
            // เงื่อนไขที่ 1: ตึกอยู่ข้างในโซนนี้ 100%
            isFullyInsideSomeZone = true;
            matchedZone = zone;
            break; 
        } else if (isIntersecting) {
            // เงื่อนไขที่ 2: ทับซ้อนนะ แต่ไม่ได้อยู่ข้างในทั้งหมด (แปลว่ามีส่วนที่ล้นออกไป)
            isPartiallyIntersecting = true;
            // ยังไม่ break เพราะอาจจะไป within กับโซนอื่นที่ใหญ่กว่าก็ได้ (ถ้ามี)
        }
    }

    // ค้นหาแปลงที่ดิน (Parcel) ที่ตึกกำลังวาดทับอยู่
    let matchedParcel = null;
    for (let parcel of this.parcelsData) {
        if (!parcel.geometry || !parcel.geometry.rings) continue;
        
        const parcelPolygon = new Polygon({
            rings: parcel.geometry.rings,
            spatialReference: parcel.geometry.spatialReference || { wkid: 3857 }
        });

        // ถ้าตึกวาดอยู่ในที่ดินแปลงนี้
        if (geometryEngine.within(buildingGeometry, parcelPolygon)) {
            matchedParcel = parcel;
            break;
        }
    }

    // ปริ้นท์ค่าออกมาดู
    // if (matchedParcel) {
    //     console.log("📍 แปลงที่ดินปัจจุบัน (Parcel):", matchedParcel);
    //     console.log("ข้อมูลพื้นที่ Area:", matchedParcel.attributes?.Area);
    // } else {
    //     console.log("📍 ไม่พบแปลงที่ดินบริเวณที่วาด (วาดนอกเขต)");
    // }

    // --- สรุปผลลัพธ์ ---
    if (isFullyInsideSomeZone && matchedZone) {
        // [เคสที่ 1]: วาดในโซนพอดีเป๊ะ -> ไปเช็ค Attributes (Regulation) ต่อ
        const heightMax = matchedZone.zoneType?.attributes?.HeightMax;
        const coverageMax = matchedZone.zoneType?.attributes?.CoverageMax;
        const farMax = matchedZone.zoneType?.attributes?.FARMax;

        const spaceUse = Math.round(geometryEngine.geodesicArea(buildingGeometry, "square-meters"))
        const spaceAllow = Math.round(matchedParcel.attributes?.Area * coverageMax)
        const currentCoverage = Math.round((spaceUse / spaceAllow) * (coverageMax*100));
        const maxCoverage = coverageMax*100

        // ใช้จำนวนชั้นจำลอง (ถ้ามีส่งมา) หรือใช้ค่าปัจจุบัน
        const numFloors = simulatedNumFloors ?? (this.activeSpacesSignal().length > 0 ? this.activeSpacesSignal().length : 1);
        
        const currentFar = (currentCoverage/100) * numFloors;
        
        console.log(`[PASS] ตึกวาดอยู่ภายในโซนสมบูรณ์ ความสูงจำกัดคือ ${heightMax} เมตร`);

        // check regulation far
        
        if (farMax !== undefined && currentFar > farMax) {
          
          return {
            status: "error",
            message: `FAR (${currentFar.toFixed(2)}) เกินกว่าที่กำหนด! (สูงสุด ${farMax}) กรุณาลดจำนวนชั้นหรือขนาดตึก`
          }
        }
        
        // TODO: เช็ค Regulation เช่น ความสูงเกินไหม
        const checkHeight = simulatedTotalHeight ?? this.buildingHeight;
        if (heightMax !== undefined && checkHeight > heightMax) {
            return {
              status: "error",
              message: `ความสูงเกิน! ความสูงต้องไม่เกิน ${heightMax} เมตร`
            }
        }
        
        
        // check regulation coverage
        
        if (currentCoverage >= maxCoverage) {
          return {
            status: "error",
            message: `Coverage ${currentCoverage} มากเกินไป กรุณาลดขนาดตึก ให้ไม่เกิน ${maxCoverage} !`
          }
        }

        
        console.log("FAR: ", currentFar, farMax);
        console.log("Height: ", this.buildingHeight, heightMax)
        console.log("Coverage: ", currentCoverage, maxCoverage);


        // ผ่านทุกกรณี
        console.log("-> ผ่านทุกเงื่อนไข ! สร้างสำเร็จ !");
        return {
          status: "success",
          message: "สร้างสำเร็จ!"
        }
        

    } else if (isPartiallyIntersecting) {
        // [เคสที่ 2]: วาดทับโซนนะ แต่มีส่วนที่ล้นออกมานอกขอบเขตโซน
        console.warn("[WARNING] ตึกมีส่วนที่ล้นออกไปนอกโซน กรุณาวาดให้อยู่ภายในขอบเขตของโซน");
        return {
          status: "error",
          message: "ตึกมีส่วนที่ล้นออกไปนอกโซน กรุณาวาดให้อยู่ภายในขอบเขตของโซน"
        }
        // ไม่ต้องไปเช็ค Attributes ต่อ ตามที่คุณต้องการ

    } else {
        // [เคสที่ 3]: ไม่ได้แตะโซนไหนเลย (วาดข้างนอกล้วนๆ)
        console.log("[FREE] ตึกนี้ไม่ได้อยู่ในโซนไหนเลย จะทำอะไรก็ทำได้เลยครับ");
        return {
            status: "success",
            message: "สร้างสำเร็จ!"
        }
    }
  }

  // TODO: ในอนาคตจะยิง API เพื่อเช็ค regulation (เช่น ความสูงเกินที่โซนกำหนดหรือไม่)
  confirmBuilding() {
    console.log("=== ยืนยันการสร้างตึก ===");
    console.log("ความสูง:", this.buildingHeight, "เมตร");

    if (this.activeGraphic) {
      const polygon = this.activeGraphic.geometry as any;
      console.log("พิกัด (Rings):", JSON.stringify(polygon.rings, null, 2));
      
      // เรียกฟังก์ชันเช็คพื้นที่ทับซ้อน
      if (this.checkZoneRegulation()!.status === "error"){
        alert(this.checkZoneRegulation()!.message);
        
        // --- ADDED REVERT LOGIC ---
        // ลบกราฟิกที่เพิ่งวาดทิ้งไปเลย
        this.graphicsLayer.remove(this.activeGraphic);
        this.isDrawingComplete = false;
        this.activeGraphic = null;
        this.buildingHeight = this.DEFAULT_HEIGHT;
        this.updateSketchSymbol();
      } else {
        alert(this.checkZoneRegulation()!.message)
        console.log(this.activeGraphic)
        
        // ยิง Mutation เพื่อบันทึกตึกลงฐานข้อมูล
        this.createMutationBuilding();
        console.log("geometry: ",this.activeGraphic.geometry.rings);

        // reset สถานะกลับคืน
        this.isDrawingComplete = false;
        this.activeGraphic = null;
        this.buildingHeight = this.DEFAULT_HEIGHT;
        this.updateSketchSymbol();
      }
    }

    // TODO: เรียก API เช็ค regulation ตรงนี้

    if (this.sketchViewModel) {
      this.sketchViewModel.complete();
    }
  }

  // TODO: ในอนาคตจะยิง API เพื่อเช็ค regulation หลังแก้ไขตึก
  confirmEdit() {
    console.log("=== ยืนยันการแก้ไขตึก ===");
    console.log("ความสูงใหม่:", this.buildingHeight, "เมตร");

    if (this.activeGraphic) {
      const polygon = this.activeGraphic.geometry as any;
      console.log("พิกัด (Rings):", JSON.stringify(polygon.rings, null, 2));

      // เรียกฟังก์ชันเช็คพื้นที่ทับซ้อน
      if (this.checkZoneRegulation()!.status === "error"){
        alert(this.checkZoneRegulation()!.message)

        // --- ADDED REVERT LOGIC ---
        // คืนค่าพิกัดเดิม
        this.activeGraphic.geometry = this.originalGeometry;
        // คืนค่าความสูงเดิม
        this.buildingHeight = this.originalHeight;
        this.activeGraphic.symbol = new PolygonSymbol3D({
          symbolLayers: [
            new ExtrudeSymbol3DLayer({
              size: this.originalHeight,
              material: { color: "#ffffff" }
            })
          ]
        });
        
        // reset สถานะ
        this.isBoxSelected = false;
        this.activeGraphic = null;
        this.activeSpaceGlobalIDs = [];
        this.buildingHeight = this.DEFAULT_HEIGHT;
        this.updateSketchSymbol();
      } else {
        alert(this.checkZoneRegulation()!.message)

        // ยิง Mutation เพื่ออัปเดตตึกในฐานข้อมูล
        this.updateMutationBuilding();

        // reset สถานะกลับคืน
        this.isDrawingComplete = false;
        this.activeGraphic = null;
        this.activeSpaceGlobalIDs = [];
        this.buildingHeight = this.DEFAULT_HEIGHT;
        this.updateSketchSymbol();
      }
    }

    // TODO: เรียก API เช็ค regulation ตรงนี้
    
    // สั่งให้ SketchViewModel ยกเลิกโหมดแก้ไข
    if (this.sketchViewModel) {
      this.sketchViewModel.complete();
    }
  }

  createMutationBuilding() {
    if (!this.activeGraphic) return;

    

    const graphicToUpdate = this.activeGraphic; // จำกราฟิกตัวนี้ไว้ก่อน
    const polygon = graphicToUpdate.geometry as any;

    // แปลง 2D ให้กลายเป็น 3D (เติม 0 ต่อท้าย) เพื่อป้องกัน Error: z value is required
    const rings3D = polygon.rings.map((ring: any[]) => 
      ring.map((pt: any[]) => pt.length === 3 ? [pt[0], pt[1], 10] : pt)
    );


    this.apiService.createSpace(rings3D, this.buildingHeight, 0).subscribe({
      next: (response) => {
        console.log("=== สร้างตึก LOD1 สำเร็จ! ===");
        console.log(response);

        // SOLUTION แบบ Minimal: เอา GlobalID ที่ได้กลับมา ยัดใส่ Graphic ตัวเดิม
        const createdSpaces = response?.data?.createSpaces;
        if (createdSpaces && createdSpaces.length > 0) {
            const newIDs = createdSpaces.map((space: any) => space.attributes.GlobalID);
            if (!graphicToUpdate.attributes) graphicToUpdate.attributes = {};
            graphicToUpdate.attributes.spaceGlobalIDs = newIDs;
            graphicToUpdate.attributes.spacesData = createdSpaces; // บันทึก space คืนกลับไปที่ graphic ทันที
            this.activeSpacesSignal.set(createdSpaces); // ยัดข้อมูลใส่ Signal
        }
      },
      error: (err) => {
        console.error("เกิดข้อผิดพลาดในการสร้างตึก:", err);
      }
    });
  }

  updateMutationBuilding() {
    const spacesData = this.activeSpacesSignal();
    if (!this.activeGraphic || spacesData.length === 0) return;
    
    const polygon = this.activeGraphic.geometry as any;
    const baseRings = polygon.rings;

    // เรียงชั้นตาม FloorNumber จากน้อยไปมาก
    const sortedSpaces = [...spacesData].sort((a, b) => a.attributes.FloorNumber - b.attributes.FloorNumber);
    const numFloors = sortedSpaces.length;
    const newFloorHeight = this.buildingHeight / numFloors; // ความสูงต่อชั้น = ความสูงรวม / จำนวนชั้น
    
    // หา baseZ (ความสูงที่ฐานของชั้นล่างสุด)
    const firstSpaceOrigRings = sortedSpaces[0].geometry?.rings;
    const baseZ = (firstSpaceOrigRings && firstSpaceOrigRings[0] && firstSpaceOrigRings[0][0] && firstSpaceOrigRings[0][0].length >= 3) 
                    ? firstSpaceOrigRings[0][0][2] 
                    : 0;

    const updateSpacesData = sortedSpaces.map((space: any, index: number) => {
      const gid = space.attributes.GlobalID;
      
      // คำนวณแกน Z ใหม่: ฐาน + (ความสูงต่อชั้น * ลำดับชั้น)
      const newZ = baseZ + (index * newFloorHeight);

      // สร้าง rings ใหม่ ให้เอา XY จาก polygon ที่แก้เสร็จ และยัด Z ใหม่ที่คำนวณได้
      const rings3D = baseRings.map((ring: any[]) => 
        ring.map((pt: any[]) => [pt[0], pt[1], newZ])
      );

      return {
        attributes: {
          GlobalID: gid,
          FloorHeight: newFloorHeight // อัปเดตความสูงต่อชั้นเป็นค่าใหม่ตามที่ปรับในหน้าเว็บ
        },
        geometry: {
          rings: rings3D,
          spatialReference: { wkid: 3857 }
        }
      };
    });

    
    this.apiService.updateSpace(updateSpacesData).subscribe({
      next: (response) => {
        console.log("=== อัปเดตตึกสำเร็จ! ===");
        console.log(response);
      },
      error: (err) => {
        console.error("เกิดข้อผิดพลาดในการอัปเดตตึก:", err);
      }
    });
  }

  deleteMutationBuilding(globalIDs: string[]) {
    if (!globalIDs || globalIDs.length === 0) return;

    
    this.apiService.deleteSpace(globalIDs).subscribe({
      next: (response) => {
        console.log("=== ลบตึกออกจากระบบสำเร็จ! ===");
        console.log(response);
      },
      error: (err) => {
        console.error("เกิดข้อผิดพลาดในการลบตึก:", err);
      }
    });
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;
    const view = this.sceneComponent.view;

    if (this.sceneComponent.map){
      this.sceneComponent.map.add(this.zoneGraphicsLayer); // แยก Layer สำหรับแสดงโซนเฉยๆ ไม่ให้ขยับได้
      this.sceneComponent.map.add(this.parcelGraphicsLayer); // Layer สำหรับแสดงแปลงที่ดิน
      this.sceneComponent.map.add(this.graphicsLayer);
    }

    this.sketchViewModel = new SketchViewModel({
      view: view,
      layer: this.graphicsLayer, // Sketch จะยุ่งแค่กับ graphicsLayer เท่านั้น
      updateOnGraphicClick: true,
      defaultUpdateOptions: {
        tool: "reshape" // ใช้โหมด reshape เพื่อให้ดึงแก้พิกัดทีละมุมได้
      }
    });

    this.updateSketchSymbol();

    // ดักจับ Event เมื่อวาดเสร็จ
    this.sketchViewModel.on("create", (event) => {
      if (event.state === "complete") {
        let polygon: any;
        if (event.graphic){
          polygon = event.graphic.geometry as any;
          this.activeGraphic = event.graphic; // เก็บตึกที่เพิ่งวาดเสร็จไว้
        }
        this.isDrawingComplete = true; // โชว์ปุ่มยืนยัน
        this.cdr.detectChanges();
        console.log("=== สกัดพิกัด (Rings) เมื่อสร้างเสร็จ ===");
        console.log(JSON.stringify(polygon.rings, null, 2));
      }

    });

    this.sketchViewModel.on("update", (event) => {
      // เมื่อคลิกเลือกตึก (ดึงค่าความสูงมาแสดงแค่ตอน start เท่านั้น)
      if (event.state === "start") {
        if (event.graphics.length > 0) {
          // ถ้ากำลังอยู่ในโหมดสร้างตึกใหม่อยู่ ไม่ต้องเปิดโหมดแก้ไขซ้อน
          if (!this.isDrawingComplete) {
            this.isBoxSelected = true;
          }
          this.activeGraphic = event.graphics[0];

          // จดจำค่าดั้งเดิมเอาไว้เผื่อต้องย้อนกลับ (Revert)
          this.originalGeometry = this.activeGraphic.geometry.clone();

          // ดึงค่าความสูงจาก symbol มาใส่ช่อง Input
          const symbol = this.activeGraphic.symbol as any;
          if (symbol && symbol.symbolLayers && symbol.symbolLayers.length > 0) {
            const layer = symbol.symbolLayers.getItemAt ? symbol.symbolLayers.getItemAt(0) : symbol.symbolLayers[0];
            if (layer && layer.size !== undefined) {
              this.buildingHeight = layer.size;
              this.originalHeight = layer.size; // จดจำความสูงดั้งเดิม
            }
          } else {
              this.originalHeight = this.DEFAULT_HEIGHT;
          }
          this.cdr.detectChanges();

          // เก็บ GlobalID ของ spaces ไว้ใช้ตอนยิง updateMutation
          const attrs = this.activeGraphic.attributes;
          this.activeSpaceGlobalIDs = attrs?.spaceGlobalIDs || [];
          
          // เก็บข้อมูล spaces และปริ้นออกมาดูตามที่ user ต้องการ
          const activeSpacesData = attrs?.spacesData || [];
          this.activeSpacesSignal.set(activeSpacesData); // อัปเดต signal
          console.log("=== ข้อมูล Space ของตึกที่ถูกเลือก ===");
          console.log(this.activeSpacesSignal());
        }
      }

      // เมื่อเสร็จสิ้นการแก้ไข -> reset ค่ากลับเป็น default
      if (event.state === "complete") {
        this.isBoxSelected = false;
        this.activeGraphic = null;
        this.activeSpaceGlobalIDs = [];
        this.activeSpacesSignal.set([]); // รีเซ็ต signal ให้ว่าง
        this.buildingHeight = this.DEFAULT_HEIGHT;
        this.updateSketchSymbol();
        this.cdr.detectChanges();

        if (event.graphics.length > 0) {
          const polygon = event.graphics[0].geometry as any;
          console.log("=== สกัดพิกัด (Rings) เมื่อแก้ไขเสร็จ ===");
          console.log(JSON.stringify(polygon.rings, null, 2));
        }
      }
    });

    // ดักจับ Event ลบ (เมื่อเลือกตึกแล้วกด Delete/Backspace)
    this.sketchViewModel.on("delete", (event) => {
      // event.graphics คือ Array ของตึกที่ถูกเลือกลบ (อาจลบพร้อมกันหลายตึกได้)
      event.graphics.forEach((graphic: any) => {
        const attrs = graphic.attributes;
        if (attrs && attrs.spaceGlobalIDs && attrs.spaceGlobalIDs.length > 0) {
          console.log("กำลังลบตึก GlobalIDs:", attrs.spaceGlobalIDs);
          // ยิง API ลบตึก
          this.deleteMutationBuilding(attrs.spaceGlobalIDs);
        } else {
          console.log("ตึกที่ลบยังไม่มี GlobalID ในระบบ (อาจเป็นตึกที่เพิ่งวาดแต่ยังไม่ได้เซฟ)");
        }
      });
      
      // Reset สถานะต่างๆ ให้กลับเป็นปกติ
      this.isBoxSelected = false;
      this.activeGraphic = null;
      this.activeSpaceGlobalIDs = [];
      this.buildingHeight = this.DEFAULT_HEIGHT;
      this.updateSketchSymbol();
      this.cdr.detectChanges();
    });
  }

  drawZoningPolygon(geometry: any) {
    if (!geometry || !geometry.rings) return;

    const polygon = new Polygon({
      rings: geometry.rings,
      spatialReference: geometry.spatialReference
    });

    const fillSymbol = new SimpleFillSymbol({
      color: [135, 206, 235, 0.4], // สีฟ้าอ่อนโปร่งใส 40% (Sky Blue)
      outline: {
        color: [135, 206, 235, 1], // เส้นขอบสีฟ้า
        width: 2
      }
    });

    const graphic = new Graphic({
      geometry: polygon,
      symbol: fillSymbol
    });

    this.zoneGraphicsLayer.add(graphic); // แปะลงใน Layer แยก จะได้คลิกขยับไม่ได้
    console.log("Draw zoning polygon success!");
  }

  drawParcelPolygon(geometry: any) {
    if (!geometry || !geometry.rings) return;

    const polygon = new Polygon({
      rings: geometry.rings,
      spatialReference: geometry.spatialReference || { wkid: 3857 }
    });

    const fillSymbol = new SimpleFillSymbol({
      color: [255, 255, 255, 0], // สีโปร่งใส
      outline: {
        color: [255, 165, 0, 1], // สีส้ม (Orange)
        width: 3,
        style: "short-dash"
      }
    });

    const graphic = new Graphic({
      geometry: polygon,
      symbol: fillSymbol
    });

    this.parcelGraphicsLayer.add(graphic);
    console.log("Draw parcel polygon success!");
  }

  renderExistingBuilding(geometry: any, height: number, spaceGlobalIDs: string[] = [], spacesData: any[] = []) {
    if (!geometry || !geometry.rings) return;

    const polygon = new Polygon({
      rings: geometry.rings,
      spatialReference: { wkid: 3857 } // อ้างอิงจากโซน หรือใช้ของแผนที่
    });

    const polygonSymbol = new PolygonSymbol3D({
      symbolLayers: [
        new ExtrudeSymbol3DLayer({
          size: height,
          material: { color: "#ffffff" }
        })
      ]
    });

    const graphic = new Graphic({
      geometry: polygon,
      symbol: polygonSymbol,
      attributes: {
        spaceGlobalIDs: spaceGlobalIDs,
        spacesData: spacesData
      }
    });

    // สำคัญ: เอาไปแปะใน graphicsLayer ที่ SketchViewModel จับตาดูอยู่
    this.graphicsLayer.add(graphic);
  }

  createSpace(spaces: any[]) {
    // สร้างตัวแปรเก็บข้อมูลเพื่อรวมตึกที่มีพิกัดแกน X, Y ตรงกัน (ตึกเดียวกันแต่คนละชั้น)
    const buildingMap = new Map<string, { geometry: any, totalHeight: number, spaceGlobalIDs: string[], spacesData: any[] }>();

    spaces.forEach((space: any) => {
      const rings = space.geometry?.rings;
      if (!rings || rings.length === 0 || rings[0].length === 0) return;

      // ใช้พิกัด X, Y ของจุดแรกเป็นตัวแทน (Signature) เพื่อจับกลุ่มว่าเป็นตึกเดียวกันไหม
      const pt = rings[0][0];
      const footprintKey = `${pt[0].toFixed(2)}_${pt[1].toFixed(2)}`;
      
      const floorHeight = space.attributes?.FloorHeight || 0;
      const gid = space.attributes?.GlobalID;

      if (buildingMap.has(footprintKey)) {
        // ถ้าเคยเจอแล้ว ให้เอาความสูงชั้นใหม่บวกเพิ่มเข้าไป
        buildingMap.get(footprintKey)!.totalHeight += floorHeight;
        if (gid) buildingMap.get(footprintKey)!.spaceGlobalIDs.push(gid);
        buildingMap.get(footprintKey)!.spacesData.push(space);
      } else {
        // ถ้าเพิ่งเจอครั้งแรก ให้จำ geometry และความสูงไว้
        buildingMap.set(footprintKey, {
          geometry: space.geometry,
          totalHeight: floorHeight,
          spaceGlobalIDs: gid ? [gid] : [],
          spacesData: [space]
        });
      }
    });

    // เอาตึกที่จัดกลุ่มและรวมความสูงแล้วไปวาด
    buildingMap.forEach((building) => {
       const finalHeight = building.totalHeight > 0 ? building.totalHeight : 30; // ถ้าไม่มีความสูงเลยให้เป็น 30
       this.renderExistingBuilding(building.geometry, finalHeight, building.spaceGlobalIDs, building.spacesData);
    });
  }

  ngOnInit() {
    // ผู้เรียกใช้งานเป็นคนประกอบ Query ส่งไปเอง
    this.apiService.onWebLoad().subscribe({
      next: (response) => {
        console.log("=== API Response ===");
        console.log(response);

        // ดึง rings มาวาดเป็น Polygon
        try {
          const branch = response?.data?.urbanDesignDatabase?.plans?.[0]?.branches?.[0];
          
          if (branch) {
            const zones = branch.zones;
            if (zones && zones.length > 0) {
              zones.forEach((zone: any) => {
                this.zonesData.push(zone); // เก็บ zone ลง array
                this.drawZoningPolygon(zone.geometry);
              });
              console.log("=== All Zones Data ===");
              console.log(this.zonesData);
            }

            const parcels = branch.parcels;
            if (parcels && parcels.length > 0) {
              parcels.forEach((parcel: any) => {
                this.parcelsData.push(parcel); // เก็บ parcel ไว้เช็ค FAR
                this.drawParcelPolygon(parcel.geometry); // วาดแนวเขตแปลงที่ดิน
                const spaces = parcel.spaces;
                if (spaces && spaces.length > 0) {
                  this.createSpace(spaces);
                }
              });
              console.log("=== Rendered Existing Buildings ===");
            }
          }
        } catch (e) {
          console.error("Error parsing data from response", e);
        }
      },
      error: (err) => {
        console.error("API Error in ngOnInit:", err);
      }
    });
  }
}
