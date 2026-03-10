1. The connecting lines in the linked-list visualizer should be straight.  
   For linked lists with two or more pointers, the layout should change to the vertical “layer-graph” style instead of horizontal.  
   For single-pointer linked lists, the current snake layout should remain unchanged.

2. Sometimes the settings panel appears at the top of the screen instead of staying attached to the draggable element.  
   Analyze the cause, propose a solution, explain why the solution works, and create a step-by-step plan to fix it.  
   Then implement the fix according to the plan.

3.  When using the heap visualizer and the last layer is not full (i.e., not of size `2^i - 1`), the resulting graph looks unnatural and does not resemble a proper binary tree.  
   This may be caused by the layer-graph layout logic.  
   If it is difficult to modify the SVG layout directly, keep the current layer-graph approach but add invisible nodes to complete the last layer.  
   Analyze the reason, propose a solution, explain why it works, and create a step-by-step fix plan.  
   Then implement the fix according to the plan.

4.  Autocomplete does not work inside the VSCode Webview environment.  
   Analyze the reason, propose a solution, explain why it works, and create a step-by-step plan to fix it.  
   Then implement the fix according to the plan.

5.  For arrays with index-label mode set to “name”, the displayed label should show the variable name itself, not the evaluated name or value.

6.  Remove the “name” field from the Advanced Settings of the heap visualizer.  
   Also remove the label option from the Basic Settings of the heap visualizer.