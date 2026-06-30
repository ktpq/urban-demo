import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-sketch";

import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';

import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D';
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer';

@Component({
  selector: 'app-root',
  imports: [], // Removed UpperCasePipe as it's no longer used
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  mapComponent!: ArcgisMap;
  sceneComponent!: ArcgisScene;

  // ตัวแปรเก็บความสูงตึก (เริ่มต้น 50 เมตร)
  buildingHeight: number = 50;
  
  graphicsLayer = new GraphicsLayer();

  constructor(
    private apiService: ApiService
  ){}
  
  // ฟังก์ชันอัปเดตความสูงเมื่อพิมพ์ช่อง input
  updateHeight(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.buildingHeight = Number(inputElement.value) || 1; // กันกรณีพิมพ์ตัวหนังสือ
  }

  clearGraphics() {
    this.graphicsLayer.removeAll();
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;

    // Add GraphicsLayer to the scene's map
    if (this.sceneComponent.map){
      this.sceneComponent.map.add(this.graphicsLayer);
    }

    // Listen to click events on the SceneView
    this.sceneComponent.view.on("click", (evt) => {
      const point = evt.mapPoint;
      if (!point) return;

      // สร้างสัญลักษณ์ 3 มิติ เป็นทรงสี่เหลี่ยมตามความสูงที่ผู้ใช้กำหนด
      const symbol = new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            width: 20,
            height: this.buildingHeight,
            depth: 20,
            resource: { primitive: "cube" },
            material: { color: "#3B82F6" }
          })
        ]
      });

      // Create the graphic and add it to the layer
      const graphic = new Graphic({
        geometry: point,
        symbol: symbol
      });

      this.graphicsLayer.add(graphic);
      console.log(`Placed a cube at height ${this.buildingHeight}m`, point);
    });
  }

  ngOnInit() {
    // Initialization code if needed
  }
}
