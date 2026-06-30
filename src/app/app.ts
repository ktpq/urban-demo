import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-sketch";

import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';

import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import PointSymbol3D from '@arcgis/core/symbols/PointSymbol3D';
import ObjectSymbol3DLayer from '@arcgis/core/symbols/ObjectSymbol3DLayer';

@Component({
  selector: 'app-root',
  imports: [UpperCasePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  mapComponent!: ArcgisMap;
  sceneComponent!: ArcgisScene;

  selectedShape: string = 'cube';
  graphicsLayer = new GraphicsLayer();

  constructor(
    private apiService: ApiService
  ){}
  
  setShape(shape: string) {
    this.selectedShape = shape;
  }

  clearGraphics() {
    this.graphicsLayer.removeAll();
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;

    // Add GraphicsLayer to the scene's map
    this.sceneComponent.map.add(this.graphicsLayer);

    // Listen to click events on the SceneView
    this.sceneComponent.view.on("click", (evt) => {
      const point = evt.mapPoint;
      if (!point) return;

      // Create a 3D symbol based on the selected primitive shape
      const symbol = new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            width: 20, // 20 meters wide
            height: 50, // 50 meters tall
            depth: 20, // 20 meters deep
            resource: { primitive: this.selectedShape as any },
            material: { color: "#3B82F6" } // Blue color
          })
        ]
      });

      // Create the graphic and add it to the layer
      const graphic = new Graphic({
        geometry: point,
        symbol: symbol
      });

      this.graphicsLayer.add(graphic);
      console.log(`Placed a ${this.selectedShape} at`, point);
    });
  }

  ngOnInit() {
    // Initialization code if needed
  }
}
