import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-sketch";

import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';

import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import PolygonSymbol3D from '@arcgis/core/symbols/PolygonSymbol3D';
import ExtrudeSymbol3DLayer from '@arcgis/core/symbols/ExtrudeSymbol3DLayer';
import SketchViewModel from '@arcgis/core/widgets/Sketch/SketchViewModel';

@Component({
  selector: 'app-root',
  imports: [], 
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  mapComponent!: ArcgisMap;
  sceneComponent!: ArcgisScene;

  buildingHeight: number = 50;
  
  graphicsLayer = new GraphicsLayer({
    elevationInfo: {
      mode: "on-the-ground"
    }
  });
  sketchViewModel!: SketchViewModel;

  constructor(
    private apiService: ApiService
  ){}
  
  updateHeight(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.buildingHeight = Number(inputElement.value) || 1;
    this.updateSketchSymbol();
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
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;
    const view = this.sceneComponent.view;

    if (this.sceneComponent.map){
      this.sceneComponent.map.add(this.graphicsLayer);
    }

    this.sketchViewModel = new SketchViewModel({
      view: view,
      layer: this.graphicsLayer,
      updateOnGraphicClick: true,
      defaultUpdateOptions: {
        tool: "reshape" // ใช้โหมด reshape เพื่อให้ดึงแก้พิกัดทีละมุมได้
      }
    });

    this.updateSketchSymbol();

    // ดักจับ Event เมื่อวาดเสร็จ หรือแก้ไขเสร็จ
    this.sketchViewModel.on("create", (event) => {
      if (event.state === "complete") {
        let polygon: any;
        if (event.graphic){
          polygon = event.graphic.geometry as any;
        }
        console.log("=== สกัดพิกัด (Rings) เมื่อสร้างเสร็จ ===");
        console.log(JSON.stringify(polygon.rings, null, 2));
      }
    });

    this.sketchViewModel.on("update", (event) => {
      if (event.state === "complete" && event.graphics.length > 0) {
        const polygon = event.graphics[0].geometry as any;
        console.log("=== สกัดพิกัด (Rings) เมื่อแก้ไขเสร็จ ===");
        console.log(JSON.stringify(polygon.rings, null, 2));
      }
    });
  }

  ngOnInit() {
  }
}
