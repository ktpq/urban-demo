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
  
  graphicsLayer = new GraphicsLayer();
  sketchViewModel!: SketchViewModel;

  constructor(
    private apiService: ApiService
  ){}
  
  updateHeight(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.buildingHeight = Number(inputElement.value) || 1;
  }

  clearGraphics() {
    this.graphicsLayer.removeAll();
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;
    const view = this.sceneComponent.view;

    // Add GraphicsLayer to the scene's map
    this.sceneComponent.map.add(this.graphicsLayer);

    // Initialize SketchViewModel for 3D transforming
    this.sketchViewModel = new SketchViewModel({
      view: view,
      layer: this.graphicsLayer,
      updateOnGraphicClick: true, // Automatically select graphic when clicked
      defaultUpdateOptions: {
        tool: "transform" // Enable 3D transform tool (scale, rotate, translate)
      }
    });

    // Listen to click events on the SceneView
    view.on("click", async (evt) => {
      // Check if the user clicked on an existing graphic or the transform gizmo
      const response = await view.hitTest(evt);
      
      // Look for a result that belongs to our graphicsLayer
      const clickedOurGraphic = response.results.find(r => r.layer === this.graphicsLayer);
      
      // If we clicked an existing graphic, let SketchViewModel handle it.
      if (clickedOurGraphic) {
        return; 
      }

      // If SketchViewModel is currently active (e.g. user is editing), 
      // clicking outside will complete the edit. Don't create a new graphic immediately.
      if (this.sketchViewModel.state === "active") {
        return;
      }

      const point = evt.mapPoint;
      if (!point) return;

      // Create a 3D symbol based on the current height
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
      
      // Automatically select the newly created building for editing
      this.sketchViewModel.update(graphic, { tool: "transform" });
    });
  }

  ngOnInit() {
  }
}
