/**
 * Dryer Physics Engine - Enhanced Version
 * Custom rigid body physics for tennis ball in rotating drum with vanes
 * 
 * PHYSICS EXPLANATION:
 * ====================
 * We simulate the ball in the ROTATING REFERENCE FRAME of the drum.
 * This means the drum appears stationary, but we must add "fictitious forces":
 * 
 * 1. CENTRIFUGAL FORCE: F = m*ω²*r (pushes outward from rotation axis)
 * 2. CORIOLIS FORCE: F = -2m(ω × v) (deflects moving objects perpendicular to motion)
 * 3. GRAVITY: Must be transformed to rotating frame
 * 
 * The "internal wind" effect you're seeing is likely from MISSING CORIOLIS FORCE.
 * At high RPM, Coriolis becomes significant and affects trajectory realism.
 */

class DryerPhysics {
    constructor() {
        // Parameters (will be updated from UI)
        this.rpm = 20;
        this.drumRadius = 0.80; // meters (80cm)
        this.vaneCount = 5;
        this.vaneHeight = 0.30; // fraction of radius
        
        // Ball properties - NOW CONFIGURABLE for testing!
        this.ball = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            
            // BALL SIZE: Affects collision detection and visual appearance
            // Tennis ball: 0.035m, Racquetball: 0.028m, Baseball: 0.037m, Larger ball: 0.05m
            radius: 0.035, // meters
            
            // BALL MASS: More mass = less affected by air drag and Coriolis
            // Tennis ball: 0.058kg, Baseball: 0.145kg, Racquetball: 0.040kg, Heavy ball: 0.200kg
            mass: 0.058, // kg
            
            // RESTITUTION: How "bouncy" the ball is (0 = no bounce, 1 = perfect bounce)
            restitution: 0.75, // tennis ball is quite bouncy
            
            // DRAG COEFFICIENT: Sphere in turbulent air flow
            // Smooth sphere: 0.47, Tennis ball (fuzzy): 0.55, Rough sphere: 0.8
            dragCoeff: 0.55, // tennis ball has fuzzy surface
            
            // Cross-sectional area (calculated from radius)
            get area() { return Math.PI * this.radius * this.radius; }
        };
        
        // Physical constants
        this.gravity = 9.81; // m/s² - Earth's gravitational acceleration
        this.airDensity = 1.225; // kg/m³ at sea level, 20°C
        
        // Drum rotation
        this.drumAngle = 0; // current rotation angle (radians)
        this.drumAngularVelocity = 0; // ω (rad/s)
        
        // Enable/disable physics effects for debugging
        this.enableCoriolis = true;
        this.enableCentrifugal = true;
        this.enableAirDrag = true;
        
        // Surface tracking for MIDI
        this.surfaces = [];
        this.lastCollisionSurface = null;
        this.collisionCallbacks = [];
        
        // Debug info
        this.debugInfo = {
            centrifugalMagnitude: 0,
            coriolisMagnitude: 0,
            dragMagnitude: 0,
            totalVelocity: 0
        };
        
        // Initialize ball at center
        this.reset();
        this.updateSurfaces();
    }
    
    setParameters(rpm, drumSizeCm, vaneCount, vaneHeightPercent) {
        this.rpm = rpm;
        this.drumRadius = drumSizeCm / 100; // convert cm to meters
        this.vaneCount = Math.floor(vaneCount);
        this.vaneHeight = vaneHeightPercent / 100;
        
        // Update angular velocity (rad/s)
        this.drumAngularVelocity = (rpm * 2 * Math.PI) / 60;
        
        // Regenerate surfaces
        this.updateSurfaces();
    }
    
    // NEW: Allow changing ball properties during runtime for testing
    setBallProperties(radius, mass, restitution, dragCoeff) {
        if (radius !== undefined) this.ball.radius = radius;
        if (mass !== undefined) this.ball.mass = mass;
        if (restitution !== undefined) this.ball.restitution = restitution;
        if (dragCoeff !== undefined) this.ball.dragCoeff = dragCoeff;
    }
    
    updateSurfaces() {
        this.surfaces = [];
        
        // Generate surface IDs for each segment between vanes and each vane face
        for (let i = 0; i < this.vaneCount; i++) {
            // Drum segment between vanes
            this.surfaces.push({
                type: 'drum',
                id: `drum_${i}`,
                index: i,
                color: this.getSurfaceColor(i * 2)
            });
            
            // Vane surfaces (both sides)
            this.surfaces.push({
                type: 'vane_leading',
                id: `vane_${i}_lead`,
                index: i,
                color: this.getSurfaceColor(i * 2 + 1)
            });
            this.surfaces.push({
                type: 'vane_trailing',
                id: `vane_${i}_trail`,
                index: i,
                color: this.getSurfaceColor(i * 2 + 1)
            });
        }
    }
    
    getSurfaceColor(index) {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', 
            '#ff8b94', '#c7ceea', '#ffd3b6', '#ffaaa5',
            '#dcedc1', '#a8d8ea', '#ffccf9', '#b4f8c8'
        ];
        return colors[index % colors.length];
    }
    
    reset() {
        // Place ball slightly off-center
        this.ball.x = this.drumRadius * 0.3;
        this.ball.y = 0;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.drumAngle = 0;
    }
    
    onCollision(callback) {
        this.collisionCallbacks.push(callback);
    }
    
    step(dt) {
        // Update drum rotation
        this.drumAngle += this.drumAngularVelocity * dt;
        
        // =====================================================================
        // ROTATING REFERENCE FRAME PHYSICS
        // =====================================================================
        
        // 1. GRAVITATIONAL FORCE (transformed to rotating frame)
        // Gravity always points down in world frame, but drum is rotating
        const cos = Math.cos(this.drumAngle);
        const sin = Math.sin(this.drumAngle);
        
        const gravityX = -this.gravity * sin;
        const gravityY = -this.gravity * cos;
        
        // 2. CENTRIFUGAL FORCE (fictitious force in rotating frame)
        // F_centrifugal = m*ω²*r (always points away from rotation axis)
        let centrifugalX = 0;
        let centrifugalY = 0;
        
        if (this.enableCentrifugal) {
            const distFromCenter = Math.sqrt(this.ball.x * this.ball.x + this.ball.y * this.ball.y);
            if (distFromCenter > 0.0001) {
                const centrifugalMagnitude = this.drumAngularVelocity * this.drumAngularVelocity * distFromCenter;
                centrifugalX = (this.ball.x / distFromCenter) * centrifugalMagnitude;
                centrifugalY = (this.ball.y / distFromCenter) * centrifugalMagnitude;
                
                this.debugInfo.centrifugalMagnitude = centrifugalMagnitude;
            }
        }
        
        // 3. CORIOLIS FORCE (fictitious force in rotating frame) - THIS WAS MISSING!
        // F_coriolis = -2m(ω × v)
        // In 2D: F_x = -2*m*ω*v_y, F_y = 2*m*ω*v_x
        // This deflects moving objects perpendicular to their motion
        let coriolisX = 0;
        let coriolisY = 0;
        
        if (this.enableCoriolis) {
            // Note: We don't multiply by mass here since we're calculating acceleration (F/m)
            coriolisX = -2 * this.drumAngularVelocity * this.ball.vy;
            coriolisY = 2 * this.drumAngularVelocity * this.ball.vx;
            
            const coriolisMag = Math.sqrt(coriolisX * coriolisX + coriolisY * coriolisY);
            this.debugInfo.coriolisMagnitude = coriolisMag;
        }
        
        // 4. AIR DRAG FORCE (quadratic drag model)
        // F_drag = 0.5 * ρ * v² * C_d * A
        // Direction: opposite to velocity
        let dragX = 0;
        let dragY = 0;
        
        if (this.enableAirDrag) {
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            
            if (speed > 0.001) {
                // Quadratic drag force magnitude
                const dragForceMagnitude = 0.5 * this.airDensity * speed * speed * 
                                          this.ball.dragCoeff * this.ball.area;
                
                // Drag acceleration (F/m) opposing velocity
                const dragAccelMagnitude = dragForceMagnitude / this.ball.mass;
                
                dragX = -(this.ball.vx / speed) * dragAccelMagnitude;
                dragY = -(this.ball.vy / speed) * dragAccelMagnitude;
                
                this.debugInfo.dragMagnitude = dragAccelMagnitude;
            }
        }
        
        // =====================================================================
        // APPLY ALL FORCES (as accelerations)
        // =====================================================================
        
        const totalAccelX = gravityX + centrifugalX + coriolisX + dragX;
        const totalAccelY = gravityY + centrifugalY + coriolisY + dragY;
        
        this.ball.vx += totalAccelX * dt;
        this.ball.vy += totalAccelY * dt;
        
        // Update debug info
        this.debugInfo.totalVelocity = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
        
        // Update position
        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;
        
        // Check collisions
        this.handleCollisions();
    }
    
    handleCollisions() {
        const ballDist = Math.sqrt(this.ball.x * this.ball.x + this.ball.y * this.ball.y);
        
        // Check collision with drum wall
        if (ballDist + this.ball.radius > this.drumRadius) {
            const penetration = ballDist + this.ball.radius - this.drumRadius;
            
            // Normal vector (pointing toward center)
            const nx = -this.ball.x / ballDist;
            const ny = -this.ball.y / ballDist;
            
            // Move ball back to surface
            this.ball.x += nx * penetration;
            this.ball.y += ny * penetration;
            
            // Calculate relative velocity normal to surface
            const vn = this.ball.vx * nx + this.ball.vy * ny;
            
            if (vn < 0) { // Moving into wall
                // Reflect velocity with restitution
                this.ball.vx -= (1 + this.ball.restitution) * vn * nx;
                this.ball.vy -= (1 + this.ball.restitution) * vn * ny;
                
                // Determine which drum segment was hit
                const ballAngle = Math.atan2(this.ball.y, this.ball.x);
                const segmentIndex = Math.floor(((ballAngle + Math.PI) / (2 * Math.PI)) * this.vaneCount) % this.vaneCount;
                
                const surface = this.surfaces.find(s => s.type === 'drum' && s.index === segmentIndex);
                if (surface) {
                    this.triggerCollision(surface, Math.abs(vn));
                }
            }
        }
        
        // Check collision with vanes
        this.checkVaneCollisions();
    }
    
    checkVaneCollisions() {
        const vaneInnerRadius = this.drumRadius * (1 - this.vaneHeight);
        
        for (let i = 0; i < this.vaneCount; i++) {
            const vaneAngle = (i / this.vaneCount) * 2 * Math.PI;
            
            // Vane is a line segment from inner radius to drum radius
            const vx1 = vaneInnerRadius * Math.cos(vaneAngle);
            const vy1 = vaneInnerRadius * Math.sin(vaneAngle);
            const vx2 = this.drumRadius * Math.cos(vaneAngle);
            const vy2 = this.drumRadius * Math.sin(vaneAngle);
            
            // Vector from vane start to ball
            const dx = this.ball.x - vx1;
            const dy = this.ball.y - vy1;
            
            // Vane direction vector
            const vdx = vx2 - vx1;
            const vdy = vy2 - vy1;
            const vaneLength = Math.sqrt(vdx * vdx + vdy * vdy);
            
            // Project ball onto vane line
            const t = (dx * vdx + dy * vdy) / (vaneLength * vaneLength);
            
            if (t >= 0 && t <= 1) {
                // Closest point on vane
                const closestX = vx1 + t * vdx;
                const closestY = vy1 + t * vdy;
                
                // Distance from ball to vane
                const distX = this.ball.x - closestX;
                const distY = this.ball.y - closestY;
                const dist = Math.sqrt(distX * distX + distY * distY);
                
                if (dist < this.ball.radius) {
                    // Collision detected
                    const penetration = this.ball.radius - dist;
                    
                    // Normal vector (perpendicular to vane)
                    let nx = distX / dist;
                    let ny = distY / dist;
                    
                    // Move ball out of vane
                    this.ball.x += nx * penetration;
                    this.ball.y += ny * penetration;
                    
                    // Calculate relative velocity
                    const vn = this.ball.vx * nx + this.ball.vy * ny;
                    
                    if (vn < 0) {
                        // Reflect velocity
                        this.ball.vx -= (1 + this.ball.restitution) * vn * nx;
                        this.ball.vy -= (1 + this.ball.restitution) * vn * ny;
                        
                        // Determine which side of vane (leading or trailing)
                        const perpX = -vdy / vaneLength;
                        const perpY = vdx / vaneLength;
                        const side = (dx * perpX + dy * perpY) > 0 ? 'vane_leading' : 'vane_trailing';
                        
                        const surface = this.surfaces.find(s => s.type === side && s.index === i);
                        if (surface) {
                            this.triggerCollision(surface, Math.abs(vn));
                        }
                    }
                }
            }
        }
    }
    
    triggerCollision(surface, velocity) {
        // Debounce rapid collisions with same surface
        if (this.lastCollisionSurface === surface.id) {
            return;
        }
        
        this.lastCollisionSurface = surface.id;
        setTimeout(() => {
            if (this.lastCollisionSurface === surface.id) {
                this.lastCollisionSurface = null;
            }
        }, 50);
        
        // Notify all listeners
        this.collisionCallbacks.forEach(cb => cb(surface, velocity));
    }
    
    // Get ball position in screen coordinates (for rendering)
    getBallPosition(canvasSize) {
        const scale = canvasSize / (this.drumRadius * 2.2);
        const centerX = canvasSize / 2;
        const centerY = canvasSize / 2;
        
        // Transform from rotating frame to screen coordinates
        const cos = Math.cos(this.drumAngle);
        const sin = Math.sin(this.drumAngle);
        const screenX = this.ball.x * cos - this.ball.y * sin;
        const screenY = this.ball.x * sin + this.ball.y * cos;
        
        return {
            x: centerX + screenX * scale,
            y: centerY - screenY * scale,
            radius: this.ball.radius * scale
        };
    }
    
    // Get vane positions for rendering
    getVanePositions(canvasSize) {
        const scale = canvasSize / (this.drumRadius * 2.2);
        const centerX = canvasSize / 2;
        const centerY = canvasSize / 2;
        const vaneInnerRadius = this.drumRadius * (1 - this.vaneHeight);
        
        const vanes = [];
        for (let i = 0; i < this.vaneCount; i++) {
            const angle = (i / this.vaneCount) * 2 * Math.PI + this.drumAngle;
            
            const innerX = centerX + vaneInnerRadius * Math.cos(angle) * scale;
            const innerY = centerY - vaneInnerRadius * Math.sin(angle) * scale;
            const outerX = centerX + this.drumRadius * Math.cos(angle) * scale;
            const outerY = centerY - this.drumRadius * Math.sin(angle) * scale;
            
            vanes.push({ innerX, innerY, outerX, outerY, index: i });
        }
        
        return vanes;
    }
    
    // Get debug information
    getDebugInfo() {
        return {
            ...this.debugInfo,
            rpm: this.rpm,
            angularVel: this.drumAngularVelocity.toFixed(3),
            ballMass: this.ball.mass,
            ballRadius: this.ball.radius,
            position: `(${this.ball.x.toFixed(3)}, ${this.ball.y.toFixed(3)})`,
            velocity: `(${this.ball.vx.toFixed(3)}, ${this.ball.vy.toFixed(3)})`
        };
    }
}
