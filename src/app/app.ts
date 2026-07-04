import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-sketch";

import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ChangeDetectorRef } from '@angular/core';
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
  activeSpaceGlobalIDs: string[] = []; // เก็บ GlobalID ของ spaces ตอนคลิกเลือกตึก
  
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
            material: { color: "#ffffff" }
          })
        ]
      });
    }
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

  checkZoneRegulation() {
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

    // --- สรุปผลลัพธ์ ---
    if (isFullyInsideSomeZone && matchedZone) {
        // [เคสที่ 1]: วาดในโซนพอดีเป๊ะ -> ไปเช็ค Attributes (Regulation) ต่อ
        const heightMax = matchedZone.zoneType?.attributes?.HeightMax;
        console.log(`[PASS] ตึกวาดอยู่ภายในโซนสมบูรณ์ ความสูงจำกัดคือ ${heightMax} เมตร`);
        
        // TODO: เช็ค Regulation เช่น ความสูงเกินไหม
        if (heightMax !== undefined && this.buildingHeight > heightMax) {
            console.log("-> ❌ แต่ความสูงเกิน!");
            return {
              status: "error",
              message: `ความสูงเกิน! ความสูงต้องไม่เกิน ${heightMax} เมตร`
            }
        } else {
            console.log("-> ✅ ความสูงผ่าน สร้างได้!");
            return {
              status: "success",
              message: "สร้างสำเร็จ!"
            }
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

    const mutationQuery = `
      mutation CreateSpace($urbanDesignDatabaseId: PortalItemId!, $newSpace: [CreateSpaceInput!]!){
    createSpaces(urbanDatabaseId: $urbanDesignDatabaseId, spaces: $newSpace){
        geometry {
            rings
        }
        attributes {
            GlobalID
            BranchID
            CustomID
        }
    }
}
    `;

    const polygon = this.activeGraphic.geometry as any;

    // แปลง 2D ให้กลายเป็น 3D (เติม 0 ต่อท้าย) เพื่อป้องกัน Error: z value is required
    // const rings3D = polygon.rings.map((ring: any[]) => 
    //   ring.map((pt: any[]) => pt.length === 2 ? [pt[0], pt[1], 0] : pt)
    // );

    const mutationVariables = {
      urbanDesignDatabaseId: "057f8a4e29d94c8188f1eb4e08190931",
      newSpace: [
        {
            geometry: {
                rings: polygon.rings,
                spatialReference: {
                    wkid: 3857
                }
            },
            attributes: {
                ParcelID: "9d7bfb92-96b6-4b7e-b840-aeb93d5ae5a6",
                SpaceType: "Building",
                SpaceUseTypeID: "15585cae-fec0-4050-8ecc-dd2f6619d5a6",
                FloorHeight: this.buildingHeight,
                BuildingNumber: 1,
                FloorNumber: 1,
                BranchID:"95d8c735-991b-436f-ae2b-461c82deaee1"
            }
        }
   ]
    };

    console.log("=== Sending Mutation ===", mutationVariables);
    this.apiService.executeGraphQL(mutationQuery, mutationVariables).subscribe({
      next: (response) => {
        console.log("=== สร้างตึก LOD1 สำเร็จ! ===");
        console.log(response);
      },
      error: (err) => {
        console.error("เกิดข้อผิดพลาดในการสร้างตึก:", err);
      }
    });
  }

  updateMutationBuilding() {
    if (!this.activeGraphic || this.activeSpaceGlobalIDs.length === 0) return;

    const mutationQuery = `
      mutation UpdateSpace($urbanDesignDatabaseId: PortalItemId!, $updateSpaces: [UpdateSpaceInput!]!) {
        updateSpaces(urbanDatabaseId: $urbanDesignDatabaseId, spaces: $updateSpaces) {
          attributes {
            GlobalID
            BranchID
          }
        }
      }
    `;

    const polygon = this.activeGraphic.geometry as any;
    const rings3D = polygon.rings.map((ring: any[]) =>
      ring.map((pt: any[]) => pt.length === 2 ? [pt[0], pt[1], 0] : pt)
    );

    // สร้าง Array ของ spaces ที่ต้อง update (ทุกชั้นที่อยู่ในตึกเดียวกัน)
    const updateSpacesData = this.activeSpaceGlobalIDs.map((gid: string) => ({
      attributes: {
        GlobalID: gid,
        FloorHeight: this.buildingHeight
      },
      geometry: {
        rings: rings3D,
        spatialReference: { wkid: 3857 }
      }
    }));

    const mutationVariables = {
      urbanDesignDatabaseId: "057f8a4e29d94c8188f1eb4e08190931",
      updateSpaces: updateSpacesData
    };

    console.log("=== Sending Update Mutation ===", mutationVariables);
    this.apiService.executeGraphQL(mutationQuery, mutationVariables).subscribe({
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

    const mutationQuery = `
      mutation DeleteSpace($urbanDatabaseId: PortalItemId!, $globalIDs: [GlobalID!]!) {
        deleteSpaces(
          urbanDatabaseId: $urbanDatabaseId, 
          globalIDs: $globalIDs, 
          cascade: true
        ) {
          attributes {
            GlobalID
          }
        }
      }
    `;

    const mutationVariables = {
      urbanDatabaseId: "057f8a4e29d94c8188f1eb4e08190931",
      globalIDs: globalIDs
    };

    console.log("=== Sending Delete Mutation ===", mutationVariables);
    this.apiService.executeGraphQL(mutationQuery, mutationVariables).subscribe({
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
        }
      }

      // เมื่อเสร็จสิ้นการแก้ไข -> reset ค่ากลับเป็น default
      if (event.state === "complete") {
        this.isBoxSelected = false;
        this.activeGraphic = null;
        this.activeSpaceGlobalIDs = [];
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

  renderExistingBuilding(geometry: any, height: number, spaceGlobalIDs: string[] = []) {
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
        spaceGlobalIDs: spaceGlobalIDs
      }
    });

    // สำคัญ: เอาไปแปะใน graphicsLayer ที่ SketchViewModel จับตาดูอยู่
    this.graphicsLayer.add(graphic);
  }

  createSpace(spaces: any[]) {
    // สร้างตัวแปรเก็บข้อมูลเพื่อรวมตึกที่มีพิกัดแกน X, Y ตรงกัน (ตึกเดียวกันแต่คนละชั้น)
    const buildingMap = new Map<string, { geometry: any, totalHeight: number, spaceGlobalIDs: string[] }>();

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
      } else {
        // ถ้าเพิ่งเจอครั้งแรก ให้จำ geometry และความสูงไว้
        buildingMap.set(footprintKey, {
          geometry: space.geometry,
          totalHeight: floorHeight,
          spaceGlobalIDs: gid ? [gid] : []
        });
      }
    });

    // เอาตึกที่จัดกลุ่มและรวมความสูงแล้วไปวาด
    buildingMap.forEach((building) => {
       const finalHeight = building.totalHeight > 0 ? building.totalHeight : 30; // ถ้าไม่มีความสูงเลยให้เป็น 30
       this.renderExistingBuilding(building.geometry, finalHeight, building.spaceGlobalIDs);
    });
  }

  ngOnInit() {
    // ผู้เรียกใช้งานเป็นคนประกอบ Query ส่งไปเอง
    const myQuery = `
      query {
    urbanDesignDatabase(urbanDesignDatabaseId: "057f8a4e29d94c8188f1eb4e08190931"){
        plans{
            branches(filter: {globalIDs: "95d8c735-991b-436f-ae2b-461c82deaee1"}){
                attributes {
                    GlobalID
                    BranchName
                }
                parcels{
                    spaces {
                        attributes {
                            GlobalID
                            FloorHeight
                            FloorNumber
                        }
                        geometry {
                            rings
                        }
                    }
                }
                zones {
                    geometry {
                        rings
                        spatialReference {
                            wkid
                        }
                    }
                    zoneType {
                        attributes {
                            HeightMax
                            CoverageMax
                        }
                    }
                }
            }
            
            
        }

    }
}

    `;

    const myVariables = {
      id: "ec88218ad29b4f5c919de98764259515"
    };

    this.apiService.executeGraphQL(myQuery, myVariables).subscribe({
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
