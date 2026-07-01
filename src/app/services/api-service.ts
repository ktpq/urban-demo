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
  executeGraphQL(query: string, variables: any = {}): Observable<any> {
    const headers = new HttpHeaders({
      "X-Esri-Authorization": `Bearer ${environment.urbanApiKey}`,
      "Content-Type": "application/json"
    });
    
    const payload = {
      query: query,
      // variables: variables
    };

    return this.http.post(environment.urbanApiUrl, payload, { headers }).pipe(
      catchError((error) => {
        console.error('GraphQL API Error:', error);
        return throwError(() => new Error('Failed to execute GraphQL query.'));
      })
    );
  }
}