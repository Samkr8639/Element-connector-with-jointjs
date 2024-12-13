import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app/app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';



// Define your routes here
const routes: Routes = [
  {
    path: '',
    component: AppComponent, // Route for the AppComponent
  },
];

@Component({
  selector: 'app-root',
  template: `
    <router-outlet></router-outlet>
  `,
  standalone: true,
  imports: [RouterModule], // Import RouterModule for routing
})
export class App {}

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideAnimations(), provideToastr()], // Provide router configuration
});
