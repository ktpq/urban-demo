import '@arcgis/map-components/components/arcgis-map';
import "@arcgis/map-components/components/arcgis-scene";

import { Component, signal, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';
import { ArcgisScene } from '@arcgis/map-components/components/arcgis-scene';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  mapComponent!: ArcgisMap;
  sceneComponent!: ArcgisScene;

  constructor(
    private apiService: ApiService
  ){}
  
  arcgisViewReadyChange(event: CustomEvent) {
    // The view is ready, add additional functionality below
    console.log('Map is ready', event);
    this.mapComponent = event.target as ArcgisMap;


    this.mapComponent.view.on("click", (event) => {
      console.log(event.mapPoint);
    })
  }

  onSceneReady(event: CustomEvent) {
    console.log('Scene is ready', event);
    this.sceneComponent = event.target as ArcgisScene;

    this.sceneComponent.view.on("click", (event) => {
      console.log(event);
    })
  }

  ngOnInit() {
    // this.apiService.getUrbanProjects().subscribe({
    //   next: (response) => {
    //     console.log("response", response)
        
    //   },
    //   error: (error) => {
    //     console.log(error);
    //   }
    // })
    
  }
}
