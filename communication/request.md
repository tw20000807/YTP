1. Remove the nickname field from the graph’s “next” and “weight” settings.  
   The “next” field represents connectivity, and the “weight” field is simply the numerical weight shown on the edges, so neither of them requires a nickname.

2. The weight feature does not currently work correctly when a weight field is selected.  
   Analyze the cause of the issue, then provide a solution to ensure the selected weight field is correctly applied to all edges.

3. Add a new visualization mode for graphs where the input is an array of `vector<pair<int, int>>`, effectively representing `(u, v)` or `(u, v, w)` triples.  
   In Advanced Settings, provide the following fields:

   - from (u)  
   - to (v)  
   - weighted  
   - weighted (w)  
   - rev-edges  

   By default:  
   - `u` is the first component,  
   - `v` is the second component,  
   - `w` is the third component if “weighted” is enabled.

   When this visualizer type is selected, the Advanced Settings must follow the structure above.

4. Add a `index label` option to the Basic Settings of the array visualizer.  
   Currently, array elements always display their index; this setting should allow toggling between index and variable name.

5. Add support for visualizing heaps.  
   This should be implemented as a new visualizer.  
   The display layout is similar to a layered graph, while the settings are similar to the array visualizer.

   Basic Settings should include:
   - base  
   - limit  
   - choice_of_name  

   The `base` setting should be a toggle:
   - If base = 0:  
     Node `i` has children `2*i + 1` and `2*i + 2`.
   - If base = 1:  
     Node `i` has children `2*i` and `2*i + 1`.

   Advanced Settings should include `data` and `name`, like the array visualizer.

6. After implementing the above modifications, verify that everything works as expected by testing with `test-harness.js`.  
   Explain each modification clearly and confirm correctness through the test results.