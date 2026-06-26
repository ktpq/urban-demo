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

  getUrbanProjects(databaseId: string = "ec88218ad29b4f5c919de98764259515"): Observable<any> {
    const graphqlQuery = `
      query GetUrbanProjects($id: ID!) {
        urbanDesignDatabase(urbanDesignDatabaseId: $id) {
          projects {
            geometry {
              rings
              spatialReference {
                  wkid
              }
            }
          }
        }
      }
    `;

    const headers = new HttpHeaders({
      "X-Esri-Authorization": `Bearer ${environment.urbanApiKey}`,
      "Content-Type": "application/json"
    });
    
    const payload = {
      query: graphqlQuery,
      variables: {
        id: databaseId
      }
    };

    return this.http.post(environment.urbanApiUrl, payload, { headers }).pipe(
      catchError((error) => {
        console.error('API Error:', error);
        return throwError(() => new Error('Failed to fetch urban projects.'));
      })
    );
  }
}