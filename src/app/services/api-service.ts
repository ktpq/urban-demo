import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ApiService {

  urbanDesignDatabaseId:string = "057f8a4e29d94c8188f1eb4e08190931";
  branchId: string = "9dfb4d30-aa28-4c36-bc9f-c8409ff4cb30";
  parcelId: string = "753027a8-97d0-444a-9642-0e378866f2d7";
  spaceUseTypeId: string = "15585cae-fec0-4050-8ecc-dd2f6619d5a6";

  constructor(private http: HttpClient) {}

  /**
   * ยิง GraphQL Query/Mutation เข้า ArcGIS Urban API โดยฝัง Header ให้อัตโนมัติ
   * @param query สตริงของ GraphQL Query หรือ Mutation
   * @param variables ออบเจ็กต์ของตัวแปร (ถ้ามี)
   */

  onWebLoad(){
    const myQuery = `
      query WebLoad($urbanDesignDatabaseId: PortalItemId!, $branchId: [GlobalID!]){
    urbanDesignDatabase(urbanDesignDatabaseId: $urbanDesignDatabaseId){
        plans{
            branches(filter: {globalIDs: $branchId}){
                attributes {
                    GlobalID
                    BranchName
                }
                parcels{

                    geometry {
                        rings
                    }
                    attributes {
                        Area
                        GlobalID
                    }
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
                            FARMax
                        }
                    }
                }
            }
            
            
        }

    }
}

    `;
    const myVariables = {
      urbanDesignDatabaseId: this.urbanDesignDatabaseId,
      branchId: [this.branchId] // เปลี่ยนเป็น Array เพราะ filter: globalIDs รับเป็น Array
    };
    return this.executeGraphQL(myQuery, myVariables)
  }

  createSpace(rings3D: any[], buildingHeight: number, floorNumber: number) {
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
                    FloorHeight
                    FloorNumber
                }
            }
        }
        `;
    const mutationVariables = {
        urbanDesignDatabaseId: this.urbanDesignDatabaseId,
        newSpace: [
            { 
                geometry: {
                    rings: rings3D,
                    spatialReference: {
                        wkid: 3857
                    }
                },
                attributes: {
                    ParcelID: this.parcelId,
                    SpaceType: "Building",
                    SpaceUseTypeID: this.spaceUseTypeId,
                    FloorHeight: buildingHeight,
                    BuildingNumber: 1,
                    FloorNumber: floorNumber,
                    BranchID: this.branchId
                }
              }
            ]
        };

    return this.executeGraphQL(mutationQuery, mutationVariables);
  }

 

  createSpacesBatch(newSpacesInputs: any[]) {
    const mutationQuery = `
      mutation CreateSpacesBatch($urbanDesignDatabaseId: PortalItemId!, $newSpaces: [CreateSpaceInput!]!){
            createSpaces(urbanDatabaseId: $urbanDesignDatabaseId, spaces: $newSpaces){
                geometry {
                    rings
                }
                attributes {
                    GlobalID
                    BranchID
                    CustomID
                    FloorHeight
                    FloorNumber
                }
            }
        }
        `;
    const mutationVariables = {
        urbanDesignDatabaseId: this.urbanDesignDatabaseId,
        newSpaces: newSpacesInputs
    };

    return this.executeGraphQL(mutationQuery, mutationVariables);
  }

  updateSpace(updateSpacesData: any[]) {
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
    
    const mutationVariables = {
      urbanDesignDatabaseId: this.urbanDesignDatabaseId,
      updateSpaces: updateSpacesData
    };

    return this.executeGraphQL(mutationQuery, mutationVariables);
  }

  deleteSpace(globalIDs: string[]) {
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
          urbanDatabaseId: this.urbanDesignDatabaseId,
          globalIDs: globalIDs
        };

        return this.executeGraphQL(mutationQuery, mutationVariables);
  }
  executeGraphQL(query: string, variables: any = {}): Observable<any> {
    const headers = new HttpHeaders({
      "X-Esri-Authorization": `Bearer ${environment.urbanApiKey}`,
      "Content-Type": "application/json"
    });
    
    const payload = {
      query: query,
      variables: variables
    };

    return this.http.post(environment.urbanApiUrl, payload, { headers }).pipe(
      catchError((error) => {
        console.error('GraphQL API Error:', error);
        return throwError(() => new Error('Failed to execute GraphQL query.'));
      })
    );
  }
}