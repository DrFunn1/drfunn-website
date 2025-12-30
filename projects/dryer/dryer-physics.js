/**
 * Dryer Physics Engine
 * Custom rigid body physics for tennis ball in rotating drum with vanes
 */

class DryerPhysics {
    constructor() {
        // Parameters (will be updated from UI)
        this.rpm = 20;
        this.drumRadius = 0.80; // meters (80cm)
        this.vaneCount = 5;
        this.vaneHeight = 0.30; // fraction of radius
        
        // Ball properties
        this.ball = {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 0.035, // 3.5cm tennis ball
            mass: 0.058, // 58g tennis ball
            restitution: 0.75 // coefficient of restitution for tennis ball
        };
        
        // Gravity
        this.gravity = 9.81; // m/s²
        
        // Drum rotation
        this.drumAngle = 0;
        this.drumAngularVelocity = 0;
        
        // Surface tracking for MIDI
        this.surfaces = [];
        this.lastCollisionSurface = null;
        this.collisionCallbacks = [];
        
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
        
        // Transform to rotating reference frame
        const cos = Math.cos(this.drumAngle);
        const sin = Math.sin(this.drumAngle);
        
        // Apply gravity in rotating frame (gravity is always pointing down in world frame)
        const gravityX = -this.gravity * sin;
        const gravityY = -this.gravity * cos;
        
        // Apply centrifugal force
        const distFromCenter = Math.sqrt(this.ball.x * this.ball.x + this.ball.y * this.ball.y);
        if (distFromCenter > 0.0001) {
            const centrifugalForce = this.drumAngularVelocity * this.drumAngularVelocity * distFromCenter;
            const cfX = (this.ball.x / distFromCenter) * centrifugalForce;
            const cfY = (this.ball.y / distFromCenter) * centrifugalForce;
            
            this.ball.vx += (gravityX + cfX) * dt;
            this.ball.vy += (gravityY + cfY) * dt;
        } else {
            this.ball.vx += gravityX * dt;
            this.ball.vy += gravityY * dt;
        }
        
        // Apply air drag (simplified)
        const dragCoeff = 0.1;
        this.ball.vx *= (1 - dragCoeff * dt);
        this.ball.vy *= (1 - dragCoeff * dt);
        
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
}
