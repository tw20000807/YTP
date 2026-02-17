// @ts-nocheck
class ResizeHandle {
    constructor(handle, target, onEnd) {
        this.handle = handle;
        this.target = target;
        this.onEnd = onEnd;
        this.isResizing = false;

        this.handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            this.startX = e.clientX;
            this.startWidth = parseInt(getComputedStyle(this.target).width, 10);
            
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        });
        
        this.handleMouseMove = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            const dx = e.clientX - this.startX;
            const newWidth = this.startWidth + dx;
            if (newWidth > 150 && newWidth < 600) {
                this.target.style.width = `${newWidth}px`;
            }
        };
        
        this.handleMouseUp = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            this.isResizing = false;
            document.body.style.cursor = 'default';
            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            if (this.onEnd) this.onEnd();
        };
    }
}
