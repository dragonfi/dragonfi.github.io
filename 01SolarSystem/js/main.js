const Physics = {
  // G: 6.67408e-11; // m3 / kg / s2
  G: 1,
};

class Vector2D {
  constructor(x, y) {
    this.x = x || 0.0;
    this.y = y || 0.0;
  }
  add(other) {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }
  sub(other) {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }
  mul(scalar) {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }
  div(scalar) {
    return this.mul(1 / scalar);
  }
  abs() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  norm() {
    let length = this.abs();
    return new Vector2D(this.x / length, this.y / length);
  }
  toString() {
    return `(${this.x}, ${this.y})`;
  }
}

class Celestial {
  constructor(repr, mass, position, velocity) {
    this.density = 25.0;
    this.mass = mass;
    this.pos = position || new Vector2D();
    this.vel = velocity || new Vector2D();
    this.acc = new Vector2D();
    this.oldAcc = new Vector2D();
    this.updateRadius();
    this.repr = repr;
    this.isObsolete = false;
  }
  updateRadius() {
    this.radius = Math.pow(this.mass / this.density, 1 / 3);
  }
  applyGravity(other) {
    if (this.isCollidingWith(other)) {
      return;
    }
    // G * m1 * m2 * r.direction() / r.abs() / r.abs() / m1
    let r = other.pos.sub(this.pos);
    let rAbs = r.abs();
    let scalarPart = Physics.G * other.mass / rAbs / rAbs;
    let acc = r.norm().mul(scalarPart);
    this.acc = this.acc.add(acc);
  }
  isCollidingWith(other) {
    let r = other.pos.sub(this.pos);
    return r.abs() < (this.radius + other.radius);
  }
  resetAcc() {
    this.oldAcc = this.acc;
    this.acc = new Vector2D();
  }

  toString() {
    return `Celestial(${this.pos}, ${this.vel}, ${this.acc})`;
  }
  updateRepr() {
    this.repr.update(this.pos, this.radius);
  }
}

class CelestialDivRepr {
  constructor(worldNode) {
    this.worldNode = worldNode;
    this.id = 0;

    this.node = document.createElement("div");
    this.node.classList.add("celestial");
    this.worldNode.appendChild(this.node);
  }
  update(newPos, newRadius) {
    //console.log(this.id, newPos);
    this.node.style.position = "absolute";
    this.node.style.left = `${Math.floor(newPos.x - newRadius)}px`;
    this.node.style.top = `${Math.floor(newPos.y - newRadius)}px`;
    this.node.style.height = `${Math.floor(newRadius * 2)}px`;
    this.node.style.width = `${Math.floor(newRadius * 2)}px`;
    this.node.style.borderRadius = `${Math.floor(newRadius)}px`;
  }

  destroy() {
    this.node.remove();
    //this.worldNode.removeChild(this.node);
  }
}

class World {
  constructor(worldNode) {
    this.worldNode = worldNode;
    this.objects = [];
    this.iteration = 0;
    this.createCounter();

    this.worldNode.addEventListener("mousedown", (click) => {
      this.newCelestial(100, new Vector2D(click.layerX, click.layerY), new Vector2D());
    });
  }

  createCounter() {
    this.counterNode = document.createElement("p");
    this.worldNode.appendChild(this.counterNode);
  }

  newCelestial(...args) {
    let repr = new CelestialDivRepr(this.worldNode);
    let celestial = new Celestial(repr, ...args);
    this.objects.push(celestial);
    return celestial;
  }

  mergeCelestials(c1, c2) {
    if (c1 === c2) {
      return;
    }

    let ratio = function(w1, v1, w2, v2) {
      return (w1 * v1 + w2 * v2) / (w1 + w2);
    };
    let vectorRatio = function(w1, vec1, w2, vec2) {
      return vec1.mul(w1).add(vec2.mul(w2)).div(w1 + w2);
    };

    let mass = c1.mass + c2.mass;
    let density = ratio(c1.mass, c1.density, c2.mass, c2.density);
    let pos = vectorRatio(c1.mass, c1.pos, c2.mass, c2.pos);
    let vel = vectorRatio(c1.mass, c1.vel, c2.mass, c2.vel);

    let celestial = this.newCelestial(mass, pos, vel);
    celestial.density = density;
    celestial.updateRadius();
  }

  isOutOfBounds(obj) {
    let minX = 0;
    let minY = 0;
    let maxX = this.worldNode.offsetWidth;
    let maxY = this.worldNode.offsetHeight;

    return obj.pos.x < minX || obj.pos.x > maxX || obj.pos.y < minY || obj.pos.y > maxY;
  }

  tick(dt) {
    this.iteration += 1;
    //if (this.iteration > 100) {
    //  return;
    //}
    // Velocity verlet
    // x(t+dt) = x(t) + v(t) * dt + 0.5 * a(t) * dt * dt
    // calculate new forces for a(t+dt)
    // v(t+dt) = v(t) + 0.5 * (a(t) + a(t+dt)) * dt

    // x(t+dt) = x(t) + v(t) * dt + 0.5 * a(t) * dt * dt
    for (let obj of this.objects) {
      let velComponent = obj.vel.mul(dt);
      let accComponent = obj.acc.mul(0.5 * dt * dt);
      obj.pos = obj.pos.add(velComponent).add(accComponent);
    }

    for (let obj of this.objects) {
      obj.resetAcc();
      for (let other of this.objects) {
        obj.applyGravity(other);
      }
    }

    // v(t+dt) = v(t) + 0.5 * (a(t) + a(t+dt)) * dt
    for (let obj of this.objects) {
      let accComponent = obj.oldAcc.add(obj.acc).mul(0.5);
      obj.vel = obj.vel.add(accComponent);
    }

    for (let obj of this.objects) {
      obj.updateRepr();
    }

    let toMerge = [];
    for (let obj of this.objects) {
      for (let other of this.objects) {
        if (obj === other || obj.isObsolete || other.isObsolete) {
          continue;
        }
        if (obj.isCollidingWith(other)) {
          toMerge.push([obj,other]);
          obj.isObsolete = true;
          other.isObsolete = true;
        }
      }
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      let obj = this.objects[i];
      if (this.isOutOfBounds(obj) || obj.isObsolete) {
        obj.repr.destroy();
        this.objects.splice(i, 1);
      }
    }

    for (let objs of toMerge) {
      this.mergeCelestials(objs[0], objs[1]);
    }

    this.counterNode.textContent = this.objects.length;
    //console.log(this.iteration, this.objects.map(String));
  }
}

function runMainLoop(worldNode) {
  let world = new World(worldNode);
  world.newCelestial(100, new Vector2D(100, 100), new Vector2D(0, -15));
  world.newCelestial(100, new Vector2D(150, 100), new Vector2D(0, +15));
  for (let i of [1,2,3,4,5]) {
    world.newCelestial(100, new Vector2D(100, 100 + 20 * i), new Vector2D(20 * i, 0));
  }

  let dt = 10;
  setInterval(() => {world.tick(dt / 1000.0);}, dt);
}

function main() {
  let worlds = document.getElementsByClassName("simulation-area");
  for(let worldNode of worlds) {
    runMainLoop(worldNode);
  }
}

window.addEventListener("DOMContentLoaded", main);
