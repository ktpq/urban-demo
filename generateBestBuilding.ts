generateBestBuilding() {
    if (!this.activeGraphic) return;
    
    const buildingGeometry = this.activeGraphic.geometry;
    let matchedParcel = null;
    for (let parcel of this.parcelsData) {
        if (!parcel.geometry || !parcel.geometry.rings) continue;
        const parcelPolygon = new Polygon({
            rings: parcel.geometry.rings,
            spatialReference: parcel.geometry.spatialReference || { wkid: 3857 }
        });
        if (geometryEngine.within(buildingGeometry, parcelPolygon)) {
            matchedParcel = parcel;
            break;
        }
    }
    
    let matchedZone = null;
    for (let zone of this.zonesData) {
        if (!zone.geometry || !zone.geometry.rings) continue;
        const zonePolygon = new Polygon({
            rings: zone.geometry.rings,
            spatialReference: zone.geometry.spatialReference
        });
        if (geometryEngine.within(buildingGeometry, zonePolygon)) {
            matchedZone = zone;
            break;
        }
    }

    if (!matchedParcel || !matchedZone) {
      alert("ไม่พบข้อมูลแปลงที่ดินหรือโซนที่วาดตึกไว้");
      return;
    }

    const coverageMax = matchedZone.zoneType?.attributes?.CoverageMax || 0;
    const farMax = matchedZone.zoneType?.attributes?.FARMax || 0;
    const heightMax = matchedZone.zoneType?.attributes?.HeightMax || 0;

    if (coverageMax === 0) {
      alert("โซนนี้ไม่มีข้อกำหนด CoverageMax");
      return;
    }

    // คำนวณ Scale
    const scale = Math.sqrt(coverageMax);
    
    // ย่อส่วน Polygon (scale down from centroid)
    const parcelPolygon = new Polygon({
      rings: matchedParcel.geometry.rings,
      spatialReference: matchedParcel.geometry.spatialReference || { wkid: 3857 }
    });
    
    const centroid = parcelPolygon.extent!.center;
    const cx = centroid.x;
    const cy = centroid.y;
    
    const newRings = parcelPolygon.rings.map((ring: any[]) => 
      ring.map((pt: any[]) => [
        cx + (pt[0] - cx) * scale,
        cy + (pt[1] - cy) * scale,
        10
      ])
    );
    
    // polygon ที่เป็น best building
    const newGeometry = new Polygon({
      rings: newRings,
      hasZ: true,
      spatialReference: parcelPolygon.spatialReference
    });

    // คำนวณความสูงและจำนวนชั้น
    let maxFloors = Math.floor(farMax / coverageMax);
    // console.log("maxFloors", maxFloors);
    // console.log(farMax, coverageMax);
    if (maxFloors < 1) maxFloors = 1;
    
    let bestHeight = maxFloors * 3; // ชั้นละ 3 เมตร
    if (heightMax > 0 && bestHeight > heightMax) {
       bestHeight = heightMax;
       maxFloors = Math.floor(bestHeight / 3);
       if (maxFloors < 1) maxFloors = 1;
    }

    // Preview: อัปเดต Graphic (Local Map)
    this.activeGraphic.geometry = newGeometry;
    this.buildingHeight = bestHeight;
    this.activeGraphic.symbol = new PolygonSymbol3D({
      symbolLayers: [
        new ExtrudeSymbol3DLayer({
          size: bestHeight,
          material: { color: "#ffffff" }
        })
      ]
    });

    // Mock spacesData สำหรับให้ Preview Stats (FAR/Coverage) คำนวณได้ถูกต้อง
    const mockSpaces = [];
    for (let i = 0; i < maxFloors; i++) {
       mockSpaces.push({
         attributes: { FloorHeight: bestHeight / maxFloors, FloorNumber: i + 1 },
         geometry: { rings: newRings } // fake geometry 
       });
    }
    this.activeSpacesSignal.set(mockSpaces);
    this.isBestBuildingGenerated = true;

    // รีคำนวณ Stats ทันที
    this.updateRealtimeStats(this.activeGraphic);
    
    // ======== เริ่มกระบวนการ ยิง Service ตรงๆ ลบของเก่า & สร้างใหม่ ========
    const proceedWithCreate = () => {
      const spacesData = this.activeSpacesSignal();
      const polygon = this.activeGraphic.geometry as any;
      const baseRings = polygon.rings;
      const numFloors = spacesData.length;
      const floorHeight = this.buildingHeight / numFloors;

      const newSpacesInputs = spacesData.map((space: any, index: number) => {
        const newZ = 10 + (index * floorHeight);
        const rings3D = baseRings.map((ring: any[]) => 
          ring.map((pt: any[]) => [pt[0], pt[1], newZ])
        );
        
        return {
          geometry: {
              rings: rings3D,
              spatialReference: { wkid: 3857 }
          },
          attributes: {
              ParcelID: this.apiService.parcelId, 
              SpaceType: "Building",
              SpaceUseTypeID: this.apiService.spaceUseTypeId,
              FloorHeight: floorHeight,
              BuildingNumber: 1,
              FloorNumber: index + 1,
              BranchID: this.apiService.branchId
          }
        };
      });

      this.apiService.createSpacesBatch(newSpacesInputs).subscribe({
        next: (response) => {
          console.log("=== สร้าง Best Building ลงฐานข้อมูลสำเร็จ! ===");
          // อัปเดต ID ใหม่กลับเข้าไป เผื่อมีการแก้ไขต่อ
          const createdSpaces = response?.data?.createSpaces;
          if (createdSpaces && createdSpaces.length > 0) {
              const allIDs = createdSpaces.map((space: any) => space.attributes.GlobalID);
              this.activeSpaceGlobalIDs = allIDs;
              this.activeSpacesSignal.set(createdSpaces);
              if (this.activeGraphic) {
                  if (!this.activeGraphic.attributes) this.activeGraphic.attributes = {};
                  this.activeGraphic.attributes.spaceGlobalIDs = allIDs;
                  this.activeGraphic.attributes.spacesData = createdSpaces;
              }
          }
          alert("✨ สร้าง Best Building และบันทึกลงฐานข้อมูลสำเร็จ!");
        },
        error: (err) => {
          console.error("เกิดข้อผิดพลาดในการสร้าง Best Building:", err);
          alert("เกิดข้อผิดพลาดในการสร้างตึกใหม่");
        }
      });
    };

    if (this.activeSpaceGlobalIDs && this.activeSpaceGlobalIDs.length > 0) {
      this.apiService.deleteSpace(this.activeSpaceGlobalIDs).subscribe({
        next: () => {
          console.log("=== ลบตึกเก่าสำเร็จ ก่อนสร้าง Best Building ===");
          this.activeSpaceGlobalIDs = [];
          proceedWithCreate();
        },
        error: (err) => {
          console.error("เกิดข้อผิดพลาดในการลบตึกเก่า:", err);
          proceedWithCreate(); // ถ้าลบพลาดก็ยังให้สร้างตึกใหม่อยู่ดี
        }
      });
    } else {
      proceedWithCreate();
    }
  }