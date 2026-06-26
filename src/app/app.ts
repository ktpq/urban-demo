import '@arcgis/map-components/components/arcgis-map';

import { Component, signal, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ApiService } from './services/api-service';

import { ArcgisMap } from '@arcgis/map-components/components/arcgis-map';

import Polygon from '@arcgis/core/geometry/Polygon';

import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Graphic from '@arcgis/core/Graphic';

// interface item{
//   id: string;
//   title: string;
//   extent: any;
// }

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class App implements OnInit {
  // variables section
  mapComponent!: ArcgisMap;
  // currentPolygon!: Polygon;
  // urbanData!: any[];

  constructor(
    private apiService: ApiService
  ){}
  
  arcgisViewReadyChange(event: CustomEvent) {
    // The view is ready, add additional functionality below
    console.log('Map is ready', event);
    this.mapComponent = event.target as ArcgisMap;

    // if (this.currentPolygon){


    //   const style = new SimpleFillSymbol({
    //     color: "red",
    //     outline: {
    //       color: "blue",
    //       width: 2
    //     }
    //   })

    //   const graphic = new Graphic({
    //     symbol: style,
    //     geometry: this.currentPolygon
    //   });

    //   this.mapComponent.view.graphics.add(graphic);
    // }

    this.mapComponent.view.on("click", (event) => {
      console.log(event.mapPoint);
    })
  }

  ngOnInit() {
    this.apiService.getUrbanProjects().subscribe({
      next: (response) => {
        // this.urbanData = response.data.urbanModels;
        // const rings =  response.data.urbanDesignDatabase.projects[0].geometry.rings;
        console.log("response", response)
        // const polygon = new Polygon({
        //   rings: rings,
        //   spatialReference: {wkid: 3857}
        // })

        // this.currentPolygon = polygon as Polygon;

        // console.log(this.currentPolygon);
        
      },
      error: (error) => {
        console.log(error);
      }
    })
    
  }
}
