import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private http: HttpClient) {}

  /**
   * ยิง GraphQL Query/Mutation เข้า ArcGIS Urban API โดยฝัง Header ให้อัตโนมัติ
   * @param query สตริงของ GraphQL Query หรือ Mutation
   * @param variables ออบเจ็กต์ของตัวแปร (ถ้ามี)
   */

  onWebLoad(){
    const myQuery = `
      query {
    urbanDesignDatabase(urbanDesignDatabaseId: "057f8a4e29d94c8188f1eb4e08190931"){
        plans{
            branches(filter: {globalIDs: "9dfb4d30-aa28-4c36-bc9f-c8409ff4cb30"}){
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
      id: "ec88218ad29b4f5c919de98764259515"
    };
    return this.executeGraphQL(myQuery, myVariables)
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