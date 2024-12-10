import { Component } from '@angular/core';
import { dia, shapes, linkTools } from '@joint/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import * as joint from '@joint/core';

@Component({
  selector: 'app-app',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  namespace = shapes;
  graph: dia.Graph = new dia.Graph({}, { cellNamespace: this.namespace });
  paper!: dia.Paper;
  circ1!: dia.Element;
  rect2!: dia.Element;
  isSourceSet: boolean = false;
  sourceShape: dia.Element | null = null;
  targetShape: dia.Element | null = null;
  private existingLinks: Set<string> = new Set();
  private deleteTimeout: any;
  private isShapeDelete: any;
  private isStartConnection: boolean = false;

  constructor(private toastr: ToastrService) { }

  async ngOnInit() {
    this.circ1 = new dia.Element({
      position: { x: 100, y: 100 },
      size: { width: 100, height: 100 },
      attrs: { body: { fill: 'lightblue' } },
    });

    this.rect2 = new dia.Element({
      position: { x: 300, y: 100 },
      size: { width: 100, height: 100 },
      attrs: { body: { fill: 'lightgreen' } },
    });

    await this.initializeGraph();
    await this.setupShapes();
  }

  addConnection() {
    this.isStartConnection = !this.isStartConnection;
  }

  async initializeGraph() {
    this.paper = new dia.Paper({
      el: document.getElementById('paper') as HTMLElement,
      model: this.graph,
      width: 500,
      height: 700,
      background: { color: '#b3b3b3' },
      cellViewNamespace: this.namespace,
    });
  }

  async setupShapes() {
    this.circ1 = this.createCircle(20, 25, 150, 150, 'Hello');
    this.rect2 = this.createRectangle(95, 225, 180, 50, 'World!');

    const paperSize = { x: 0, y: 0, width: 500, height: 700 };
    this.applyDragConstraints(this.circ1, paperSize);
    this.applyDragConstraints(this.rect2, paperSize);

    this.setupLinkEvents();
  }

  addShape() {
    // You can alternate between adding circles and rectangles or add both dynamically
    const shapeType = Math.random() > 0.5 ? 'circle' : 'rectangle'; // Randomly decide between circle or rectangle
    if (shapeType === 'circle') {
      this.createCircle(
        Math.random() * 400,
        Math.random() * 600,
        150,
        150,
        'New Circle'
      );
    } else {
      this.createRectangle(
        Math.random() * 400,
        Math.random() * 600,
        180,
        50,
        'New Rectangle'
      );
    }
  }

  createCircle(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string
  ): dia.Element {
    const circle = new shapes.standard.Circle();
    circle.position(x, y);
    circle.resize(width, height);
    circle.attr('body', { stroke: '#C94A46', rx: 2, ry: 2 });
    circle.attr('label', { text: label, fill: '#353535' });
    circle.addTo(this.graph);
    return circle;
  }

  createRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string
  ): dia.Element {
    const rect = new shapes.standard.Rectangle();
    rect.position(x, y);
    rect.resize(width, height);
    rect.attr('body', { stroke: '#C94A46', rx: 2, ry: 2 });
    rect.attr('label', { text: label, fill: '#353535' });
    rect.addTo(this.graph);
    return rect;
  }

  setupLinkEvents() {
    // Event listener for when clicking anywhere on the paper
    this.paper.on('blank:pointerdown', () => {
      this.isShapeDelete = null;
      this.resetPreviousSelection();
    });

    this.paper.on('cell:pointerdown', (cellView: dia.CellView) => {
      if (this.isElement(cellView.model)) {
        this.handleCellClick(cellView.model);
      }
    });


    this.paper.on('link:mouseenter', (linkView) => {
      this.addLinkTools(linkView);
    });


    this.paper.on('link:mouseleave', (linkView) => {
      this.removeLinkTools(linkView);
    });

    // Handle link removal
    this.graph.on('remove', (cell) => {
      if (cell.isLink()) {
        const sourceId = cell.get('source').id;
        const targetId = cell.get('target').id;

        if (sourceId && targetId) {
          const relationKey = `${sourceId}-${targetId}`;
          this.existingLinks.delete(relationKey);
          console.log('Link removed:', relationKey);
        }
      }
    });
  }

  handleCellClick(clickedCell: dia.Cell) {
    // Ensure the clicked cell is an element (shape)
    if (!this.isElement(clickedCell)) {
      this.toastr.warning(
        'Only shapes can be selected as source or target.',
        'Invalid Selection'
      );
      return;
    }

    this.resetPreviousSelection();

    // Change the stroke color to green to indicate selection
    if (clickedCell.isElement()) {
      const element = clickedCell as joint.dia.Element;

      // Check if the element is a rectangle or ellipse based on its rx property
      const rx = element.attr('body').rx;
      const strokeColor = 'green';
      const strokeWidth = 3;

      if (rx === 0 || rx > 0) {
        // Set stroke to green for both rectangles and ellipses
        element.attr('body', {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
      }
    }


    this.selectedDeleteShapes(clickedCell);

    // Handle source and target logic
    if (this.isStartConnection) {
      if (!this.isSourceSet) {
        // Set the source shape
        this.setSource(clickedCell);
      } else {
        // Check for duplicate relation before setting the target
        if (this.isDuplicateRelation(this.sourceShape!, clickedCell)) {
          this.resetSelection();
          return;
        }

        // Set the target and create the link
        this.setTargetAndCreateLink(clickedCell);
      }


    }
  }

  resetPreviousSelection() {
    // Reset previously selected shapes

    this.graph.getElements().forEach((element: joint.dia.Element) => {
      const attrs = element.attributes?.attrs;
      const body = attrs?.['body'];

      if (body && body.stroke === 'green') {
        const rx = element.attr('body').rx;
        const resetStrokeColor = '#C94A46'; // Default stroke color for reset
        const resetStrokeWidth = 2;

        if (rx === 0) {
          // Rectangle logic
          element.attr('body', {
            stroke: resetStrokeColor,
            strokeWidth: resetStrokeWidth,
          });
        } else if (rx > 0) {
          // Ellipse logic
          element.attr('body', {
            stroke: resetStrokeColor,
            strokeWidth: resetStrokeWidth,
          });
        }
      }
    });
  }

  isElement(cell: dia.Cell): cell is dia.Element {
    return cell instanceof dia.Element;
  }

  isDuplicateRelation(source: dia.Element, target: dia.Element): boolean {
    if (source === target) {
      this.toastr.error(
        'Source and target cannot be the same element!',
        'Error'
      );
      return true;
    }

    const relationKey = `${source.id}-${target.id}`;
    if (this.existingLinks.has(relationKey)) {
      this.toastr.error('This link already exists!', 'Duplicate Link');
      return true;
    }

    return false;
  }

  setSource(source: dia.Element) {
  
    this.sourceShape = source;
    this.isSourceSet = true;
    console.log('Source set:', this.sourceShape);
  }

  setTargetAndCreateLink(target: dia.Element) {
    // this.selectedDeleteShapes(target);
    this.targetShape = target;
    console.log('Target set:', this.targetShape);
    this.createLink(this.sourceShape!, this.targetShape!);
    this.resetSelection();
  }

  isSameShape(element: dia.Element): boolean {
    return element === this.sourceShape;
  }

  createLink(source: dia.Element, target: dia.Element) {
    const relationKey = `${source.id}-${target.id}`;
    try {
      const link = new shapes.standard.Link();
      link.source(source, { anchor: { name: 'center', args: { dx: 30 } } });
      link.target(target, {
        anchor: { name: 'center', args: { dx: -30 } },
        connectionPoint: { name: 'boundary' },
      });
      link.vertices([
        { x: 130, y: 180 },
      ]);
      link.addTo(this.graph);

      // Add the relation to the set of existing links
      this.existingLinks.add(relationKey);
      console.log('Link created:', relationKey);
    } catch (error) {
      console.error('Error creating link:', error);
      this.toastr.error('Failed to create link.', 'Error');
    }
  }

  addLinkTools(linkView: dia.LinkView) {
    try {
      const toolsView = new dia.ToolsView({
        tools: [
          new linkTools.Vertices(),
          new linkTools.TargetArrowhead(),
          new linkTools.SourceAnchor(),
          new linkTools.TargetAnchor(),
          new linkTools.Remove({ distance: 20 }),
        ],
      });
      linkView.addTools(toolsView);
      console.log('Tools view added');
    } catch (error) {
      console.error('Error adding tools view:', error);
    }
  }

  removeLinkTools(linkView: dia.LinkView) {
    try {
      linkView.removeTools();
      this.resetSelection();
      console.log('Tools view removed');
    } catch (error) {
      console.error('Error removing tools view:', error);
    }
  }

  applyDragConstraints(
    element: dia.Element,
    paperSize: { x: number; y: number; width: number; height: number }
  ) {
    element.on('change:position', (cell: dia.Element) => {
      const position = cell.position();
      const constrainedX = Math.max(
        paperSize.x,
        Math.min(position.x, paperSize.width - cell.size().width)
      );
      const constrainedY = Math.max(
        paperSize.y,
        Math.min(position.y, paperSize.height - cell.size().height)
      );
      if (constrainedX !== position.x || constrainedY !== position.y) {
        cell.position(constrainedX, constrainedY);
      }

      // Update delete button position after moving the shape
      const deleteButton = document.querySelector(
        `[data-shape-id="${cell.id}"]`
      ) as HTMLElement;
      if (deleteButton) {
        deleteButton.style.top = `${constrainedY + 20}px`;
        deleteButton.style.left = `${constrainedX + 20}px`;
      }
    });
  }

  selectedDeleteShapes(clickedCell: dia.Element) {
    // Ensure the clicked cell is an element
    if (clickedCell instanceof dia.Element) {
      this.isShapeDelete = clickedCell;
    }
  }


  // Delete the shape and hide the button
  deleteShape(shape: dia.Element) {
    try {
      // Remove the shape from the graph
      shape.remove();

      // Remove the corresponding link from the set of existing links
      this.existingLinks.forEach((relationKey) => {
        const [sourceId, targetId] = relationKey.split('-');
        if (shape.id === sourceId || shape.id === targetId) {
          this.existingLinks.delete(relationKey);
        }
      });

      // Hide the delete button by removing it from the DOM
      const deleteButton = document.querySelector(
        `[data-shape-id="${shape.id.toString()}"]`
      );
      if (deleteButton) {
        deleteButton.remove();
      }

      // Notify user
      this.toastr.success('Shape deleted successfully.', 'Success');
    } catch (error) {
      console.error('Error deleting shape:', error);
      this.toastr.error('Failed to delete shape.', 'Error');
    }
  }

  deleteShapes() {
    this.deleteShape(this.isShapeDelete);
  }

  resetSelection() {
    this.isSourceSet = false;
    this.sourceShape = null;
    this.targetShape = null;
  }
}
