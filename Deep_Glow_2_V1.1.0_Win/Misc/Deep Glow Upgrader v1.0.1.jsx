// @target aftereffects
{
    /*
    // Create the user interface
    var win = new Window("palette", "DG Upgrade Helper v1.0");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    
    // Add radio buttons for scan options
    var scanGroup = win.add("panel", undefined, "Scan Options");
    scanGroup.orientation = "column";
    scanGroup.alignChildren = "left";
    var selectedLayerRb = scanGroup.add("radiobutton", undefined, "Selected Layer Only");
    var currentCompRb = scanGroup.add("radiobutton", undefined, "Current Composition");
    var entireProjectRb = scanGroup.add("radiobutton", undefined, "Entire Project");
    entireProjectRb.value = true; // Default selection
    
    // Add buttons
    var btnGroup = win.add("group");
    btnGroup.orientation = "row";
    btnGroup.alignChildren = "center";
    var okBtn = btnGroup.add("button", undefined, "OK");
    var closeBtn = btnGroup.add("button", undefined, "Close");
    */
    var statistics = {
        total: 0,
        successful: 0,
        failed: 0,
        failureReasons: []
    };

    // Parameters that match between versions and are keyframeable in both
    var parametersToLink = {
        // Core parameters
        "Radius": true,
        "Exposure": true,
        "Threshold": true,
        "Threshold Smooth": true,
        "Blend Mode": true,
        
        // Aspect
        "Aspect Ratio": true,
        "Enable Angle": true,
        "Aspect Angle": true,

        // Quality and View settings
        "Source Opacity": true,
        "Unmult": true
    };

    // Mapping for renamed parameters
    var parameterNameMapping = {
        "Enable": "Enable Pixel Aberration",
        "Channels": "Aberration Channels",
        "Amount": "Pixel Offset"
    };

    // Add renamed parameters to the parametersToLink object
    for (var oldName in parameterNameMapping) {
        parametersToLink[oldName] = true;
    }

    // Parameters that need parent parameters enabled first with their required values
    var conditionalParams = {
        "Aspect Angle": ["Enable Angle", 1],
        "Color": ["Enable Pixel Aberration", 1],
        "Mix": ["Enable Pixel Aberration", 1]
    };

    function resetStatistics() {
        statistics.total = 0;
        statistics.successful = 0;
        statistics.failed = 0;
        statistics.failureReasons = [];
    }
    
    // Generate expression for a parameter, handling special cases
    function generateExpression(paramName, effectInfo) {
        var baseExpression = 'thisLayer.effect("' + effectInfo.oldName + '")("' + 
                           paramName + '")';
                           
        // Special case handling
        if (paramName === "Gamma Correction") {
            return baseExpression + " * 100";
        }

        return baseExpression;
    }

    function findPropertyByPath(effect, path) {
        if (!effect) {
            alert("findPropertyByPath passed null effect");
            return null;
        }
    
        var currentGroup = effect;
        var pathParts = path.split('.');
    
        for (var i = 0; i < pathParts.length; i++) {
            var found = false;
            var partName = pathParts[i];
    
            for (var j = 1; j <= currentGroup.numProperties; j++) {
                var prop = currentGroup.property(j);
                if (prop.name === partName) {
                    currentGroup = prop;
                    found = true;
                    break;
                }
            }
    
            if (!found) {
                alert("Could not find property part: " + partName);
                return null;
            }
        }
    
        return currentGroup;
    }

    function findDuplicateNamedPEDGEffects(scanOption) 
    {
        var results = [];
        var continueB = true;
        
        // Process selected layer
        function processSelectedLayer() {
            var activeComp = app.project.activeItem;
            if (!(activeComp instanceof CompItem)) {
                alert("Please select a composition first.");
                return false;
            }
            
            var selectedLayers = activeComp.selectedLayers;
            if (selectedLayers.length === 0) {
                alert("Please select at least one layer.");
                return false;
            }
            
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                checkLayerForDuplicates(layer, activeComp, results);
            }
            return true;
        }
        
        // Process current composition
        function processCurrentComp() {
            var activeComp = app.project.activeItem;
            if (!(activeComp instanceof CompItem)) {
                alert("Please select a composition first.");
                return false;
            }
            
            processCompositions(activeComp);
            return true;
        }
        
        // Process each composition in the project
        function processCompositions(item) {
            if (item instanceof CompItem) {
                // Check each layer in the composition
                for (var i = 1; i <= item.numLayers; i++) {
                    var layer = item.layer(i);
                    checkLayerForDuplicates(layer, item, results);
                }
            }
        }
        
        // Helper function to check a layer for duplicate effects
        function checkLayerForDuplicates(layer, comp, results) {
            var pedgEffectNames = [];
            var duplicateNames = [];
            
            // Check each effect on the layer
            for (var j = 1; j <= layer.Effects.numProperties; j++) {
                var effect = layer.Effects.property(j);
                
                // Only look at PEDG effects
                if (effect.matchName === "PEDG") {
                    var effectName = effect.name;
                    
                    if (pedgEffectNames.indexOf(effectName) !== -1 && 
                        duplicateNames.indexOf(effectName) === -1) {
                        duplicateNames.push(effectName);
                    }
                    
                    pedgEffectNames.push(effectName);
                }
            }
            
            // If we found any duplicates on this layer, add to results
            if (duplicateNames.length > 0) {
                results.push({
                    composition: comp.name,
                    layer: layer.name,
                    duplicateEffects: duplicateNames
                });
            }
        }
        
        // Process all items in the project
        function processProject() {
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i) instanceof CompItem) {
                    processCompositions(app.project.item(i));
                }
            }
        }
        
        // Run the search based on scan option
        try {
            switch(scanOption) {
                case "selected":
                    continueB = processSelectedLayer();
                    break;
                case "composition":
                    continueB = processCurrentComp();
                    break;
                case "project":
                    processProject();
                    break;
            }
            
            // Report results
            if (results.length > 0) {
                continueB = false; // don't proceed
                var report = "Error: found layer/layers with multiple Deep Glow effect instances with identical names. These must have unique names before upgrading:\n\n";
                for (var i = 0; i < results.length; i++) {
                    var result = results[i];
                    report += "Composition: " + result.composition + "\n";
                    report += "Layer: " + result.layer + "\n";
                    report += "Duplicate Effect Names: " + result.duplicateEffects.join(", ") + "\n\n";
                }
                alert(report);
            }
        } catch (err) {
            alert("An error occurred: " + err.toString());
        } 

        return continueB;
    }

    function upgradeDeepGlow(scanOption) 
    {
        try {
            // first scan for duplicate effect instances
            if(findDuplicateNamedPEDGEffects(scanOption)) {
                var project = app.project;
                
                switch(scanOption) {
                    case "selected":
                        var activeComp = app.project.activeItem;
                        if (activeComp instanceof CompItem) {
                            var selectedLayers = activeComp.selectedLayers;
                            for (var i = 0; i < selectedLayers.length; i++) {
                                processLayer(selectedLayers[i]);
                            }
                        }
                        break;
                        
                    case "composition":
                        var activeComp = app.project.activeItem;
                        if (activeComp instanceof CompItem) {
                            processComposition(activeComp);
                        }
                        break;
                        
                    case "project":
                        for (var i = 1; i <= project.numItems; i++) {
                            var item = project.item(i);
                            if (item instanceof CompItem) {
                                processComposition(item);
                            }
                        }
                        break;
                }
                
                var summary = "Deep Glow upgrade complete!\n\n";
                summary += "Total effects processed: " + statistics.total + "\n";
                summary += "Successfully upgraded: " + statistics.successful + "\n";
                summary += "Failed upgrades: " + statistics.failed + "\n\n";
                
                if (statistics.failureReasons.length > 0) {
                    summary += "Failure details:\n" + statistics.failureReasons.join("\n");
                }
                
                alert(summary);
            }
        } catch (error) {
            alert("Error: " + error.toString());
        } 
    }

    function processComposition(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            processLayer(layer);
        }
    }

    function processLayer(layer) {
        if (!layer.effect) return;
        
        for (var i = layer.effect.numProperties; i >= 1; i--) {
            var effect = layer.effect(i);
            
            if (effect.matchName === "PEDG" && effect.enabled) {
                statistics.total++;
                upgradeEffect(layer, effect, i);
            }
        }
    }

    function canSetExpression(property) {
        try {
            return property instanceof Property && 
                   property.propertyType !== PropertyType.PROPERTY_GROUP && 
                   property.canVaryOverTime;
        } catch (error) {
            return false;
        }
    }

    function findPropertyByName(effect, propertyName, searchInGroups) 
    {
        if (!effect) 
        {
            alert("findPropertyByName passed null effect");
            return null;
        }
        
        // For properties we know can have duplicates, look for the 1D version specifically
        var propertiesToFind1D = ["Aspect Ratio", "Gamma Correction", "Aspect Angle"];
        var needsSpecificType = propertiesToFind1D.indexOf(propertyName) !== -1;
        
        function isMatchingProperty(prop) {
            if (prop.name !== propertyName) return false;
            if (needsSpecificType) {
                return prop.propertyValueType === PropertyValueType.OneD;
            }
            return prop.propertyValueType !== PropertyValueType.NO_VALUE;
        }
        
        for (var i = 1; i <= effect.numProperties; i++) {
            var prop = effect.property(i);
            
            // Direct match with type checking
            if (isMatchingProperty(prop)) {
                return prop;
            }
            
            // Search in groups if requested
            if (searchInGroups && prop instanceof PropertyGroup) {
                var foundInGroup = findPropertyByName(prop, propertyName, true);
                if (foundInGroup) return foundInGroup;
            }
        }
        return null;
    }

    function handleMaskLayer(oldEffect, newEffect, effectInfo) {
        try {
            // Find the Mask Layer parameter in the new effect
            var newMaskLayer = findPropertyByName(newEffect, "Mask Layer", true);
            if (!newMaskLayer) {
                statistics.failureReasons.push("Could not find Mask Layer parameter in new effect '" + 
                    effectInfo.oldName + " upgraded'");
                return;
            }
    
            // Get the layer value from index 27 of the old effect
            var oldLayerParam = oldEffect(27);
            if (!oldLayerParam) {
                statistics.failureReasons.push("Could not find layer parameter at index 27 in old effect '" + 
                    effectInfo.oldName + "'");
                return;
            }
    
            // Transfer the layer value
            try {
                newMaskLayer.setValue(oldLayerParam.value);
            } catch (error) {
                statistics.failureReasons.push("Failed to set Mask Layer value: " + error.toString());
            }

            // now transfer mode and invert
            var oldModeParam = oldEffect(28);
            if (!oldModeParam) {
                statistics.failureReasons.push("Could not find mask mode parameter at index 28 in old effect '" + 
                    effectInfo.oldName + "'");
                return;
            }

            var newMaskMode = findPropertyByName(newEffect, "Mask Mode", true);
            if (!newMaskMode) {
                statistics.failureReasons.push("Could not find mask mode parameter in new effect '" + 
                    effectInfo.oldName + " upgraded'");
                return;
            }

            try {
                newMaskMode.setValue(oldModeParam.value);
            } catch (error) {
                statistics.failureReasons.push("Failed to set mask mode value: " + error.toString());
            }

            // now invert
            var oldInvertParam = oldEffect(29);
            if (!oldInvertParam) {
                statistics.failureReasons.push("Could not find mask invert parameter at index 29 in old effect '" + 
                    effectInfo.oldName + "'");
                return;
            }

            var newMaskInvert = findPropertyByName(newEffect, "Mask Invert", true);
            if (!newMaskInvert) {
                statistics.failureReasons.push("Could not find mask invert parameter in new effect '" + 
                    effectInfo.oldName + " upgraded'");
                return;
            }

            try {
                newMaskInvert.setValue(oldInvertParam.value);
            } catch (error) {
                statistics.failureReasons.push("Failed to set mask invert value: " + error.toString());
            }

        } catch (error) {
            statistics.failureReasons.push("Failed to handle Mask Layer for effect '" + 
                effectInfo.oldName + "': " + error.toString());
        }
    }

    function handleGammaCorrection(oldEffect, newEffect, effectInfo) {
        try {
            // First find Auto Detect Gamma in the new effect
            var newAutoDetectGamma = findPropertyByName(newEffect, "Auto Detect Gamma", true);
            if (!newAutoDetectGamma) {
                statistics.failureReasons.push("Could not find Auto Detect Gamma in new effect '" + 
                    effectInfo.oldName + " upgraded'");
                return;
            }
    
            // Initially set Auto Detect Gamma to false (0) to reveal Gamma Correction
            newAutoDetectGamma.setValue(0);

            // Find and set up Gamma Correction
            var newGammaCorrection = findPropertyByName(newEffect, "Gamma Correction", true);
            if (newGammaCorrection && canSetExpression(newGammaCorrection)) {
                // Set expression for Gamma Correction
                var gammaExpression = 'var oldEffect = thisLayer.effect("' + effectInfo.oldName + '");\n' +
                                    'var oldAutoDetect = oldEffect("Auto Detect Gamma");\n' +
                                    'if (!oldAutoDetect.value) {\n' +
                                    '    oldEffect("Gamma Correction") * 100;\n' +
                                    '} else {\n' +
                                    '    value;\n' + // Keep current value if Auto Detect is on
                                    '}';
                
                newGammaCorrection.expression = gammaExpression;
            } else {
                statistics.failureReasons.push("Could not find or set Gamma Correction in new effect '" + 
                    effectInfo.oldName + " upgraded' after disabling Auto Detect");
            }
    
            // Now that Gamma Correction is set up, link Auto Detect Gamma to the old effect
            if (canSetExpression(newAutoDetectGamma)) {
                var autoDetectExpression = 'thisLayer.effect("' + effectInfo.oldName + '")("Auto Detect Gamma")';
                
                newAutoDetectGamma.expression = autoDetectExpression;
            } else {
                statistics.failureReasons.push("Could not set expression for Auto Detect Gamma in new effect '" + 
                    effectInfo.oldName + " upgraded'");
            }
            
        } catch (error) {
            statistics.failureReasons.push("Failed to handle Gamma Correction for effect '" + 
                effectInfo.oldName + "': " + error.toString());
        }
    }

    function handleTintMode(oldEffect, newEffect, effectInfo) {
        try {

            // Set Quality Preset to 5
            var qualityPreset = findPropertyByName(newEffect, "Quality Preset", true);
            if (qualityPreset) {
                qualityPreset.setValue(5);
            }

            // Handle Tint Mode parameter
            var newTintMode = findPropertyByName(newEffect, "Tint Mode", true);
            if (!newTintMode) {
                statistics.failureReasons.push("Could not find Tint Mode parameter in new effect '" + 
                    effectInfo.oldName + " upgraded'");
                return;
            }
    
            // Set Tint Mode expression
            var tintModeExpression = 'var oldEffect = thisLayer.effect("' + effectInfo.oldName + '");\n' +
                            'var checkbox = oldEffect(52);\n' +
                            'checkbox.value ? 3 : 1;';
    
            if (canSetExpression(newTintMode)) {
                newTintMode.expression = tintModeExpression;
            }
    
            // Handle Tint Blend Mode
            var newTintBlendMode = findPropertyByName(newEffect, "Tint Blend Mode", true);
            if (newTintBlendMode && canSetExpression(newTintBlendMode)) {
                newTintBlendMode.expression = 'thisLayer.effect("' + effectInfo.oldName + '")(54)';
            }
    
            // Handle Tint Strength
            var newTintStrength = findPropertyByName(newEffect, "Tint Strength", true);
            if (newTintStrength && canSetExpression(newTintStrength)) {
                newTintStrength.expression = 'thisLayer.effect("' + effectInfo.oldName + '")(55)';
            }
    
            // Handle Color/Color Inner parameter
            // Try both possible names
            var newColor = findPropertyByName(newEffect, "Color", true) || 
                          findPropertyByName(newEffect, "Color Inner", true);
            
            if (newColor && canSetExpression(newColor)) {
                newColor.expression = 'thisLayer.effect("' + effectInfo.oldName + '")(53)';
            } else {
                statistics.failureReasons.push("Could not find Color/Color Inner parameter in new effect '" + 
                    effectInfo.oldName + " upgraded'");
            }
    
        } catch (error) {
            statistics.failureReasons.push("Failed to handle Tint parameters for effect '" + 
                effectInfo.oldName + "': " + error.toString());
        }
    }

    function upgradeEffect(layer, oldEffect, effectIndex) {
        try {
            var effectInfo = {
                layerName: layer.name,
                oldName: oldEffect.name,
                oldIndex: effectIndex,
                layerIndex: layer.index
            };
            
            oldEffect.enabled = false;
            var newEffect = layer.effect.addProperty("PEDG2");
            newEffect.name = effectInfo.oldName + " upgraded";
            newEffect.moveTo(effectIndex + 1);

            try {
                var oldEffectRef = layer.effect(effectInfo.oldName);
                var newEffectRef = layer.effect(effectInfo.oldName + " upgraded");
                
                // First, handle conditional parameters and wait for UI updates
                for (var condParam in conditionalParams) {
                    var parentParam = conditionalParams[condParam][0];
                    var value = conditionalParams[condParam][1];
                    var parentProp = findPropertyByName(newEffectRef, parentParam, true);
                    if (parentProp) {
                        parentProp.setValue(value);  // Set the value first
                    }
                }
                
                // Handle all linkable parameters
                for (var paramName in parametersToLink) {
                    try {
                        var oldProp = findPropertyByName(oldEffectRef, paramName, true);
                        var newPropName = parameterNameMapping[paramName] || paramName;
                        var newProp = findPropertyByName(newEffectRef, newPropName, true);
                        
                        if (oldProp && newProp) 
                        {
                            if (canSetExpression(newProp))
                            {
                                // Expression linking
                                var expression = generateExpression(paramName, effectInfo);
                                newProp.expression = expression;
                            }
                        }
                    } catch (paramError) {
                        statistics.failureReasons.push("Failed to link " + paramName + 
                            " for effect '" + effectInfo.oldName + "': " + paramError.toString());
                    }
                }

                // handle special cases here
                try {
                    handleGammaCorrection(oldEffectRef, newEffectRef, effectInfo);
                    handleMaskLayer(oldEffectRef, newEffectRef, effectInfo);
                    handleTintMode(oldEffectRef, newEffectRef, effectInfo);
                } catch (error) {
                    statistics.failureReasons.push("Failed to process special cases: " + error.toString());
                }
                statistics.successful++;
                
            } catch (accessError) {
                statistics.failed++;
                statistics.failureReasons.push("Failed to access effect '" + effectInfo.oldName + 
                    "': " + accessError.toString());
            }
            
        } catch (error) {
            statistics.failed++;
            statistics.failureReasons.push("Failed to upgrade effect '" + effectInfo.oldName + 
                "': " + error.toString());
        }
    }

    /*
    // Handle button clicks
    okBtn.onClick = function() {
        var scanOption;
        if (selectedLayerRb.value) scanOption = "selected";
        else if (currentCompRb.value) scanOption = "composition";
        else scanOption = "project";

        resetStatistics(); // Reset statistics before starting new upgrade
        
        app.beginUndoGroup("Upgrade Deep Glow Effects");
        upgradeDeepGlow(scanOption);
        app.endUndoGroup();
    }

    closeBtn.onClick = function() {
        win.close();
    }

    win.show(0); // 0 makes it non-modal, allowing interaction with AE while the window is open
    */

    function showUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Deep Glow Upgrader v1.0.1");
        win.orientation = "column";
        win.alignChildren = ["fill", "top"]; 
        win.spacing = 10;
        win.margins = 16;
        
        // Add radio buttons for scan options
        var scanGroup = win.add("panel", undefined, "Scan Options");
        scanGroup.orientation = "column";
        scanGroup.alignChildren = "left";
        scanGroup.spacing = 6;
        scanGroup.margins = 12;
        var selectedLayerRb = scanGroup.add("radiobutton", undefined, "Selected Layer Only");
        var currentCompRb = scanGroup.add("radiobutton", undefined, "Current Composition");
        var entireProjectRb = scanGroup.add("radiobutton", undefined, "Entire Project");
        entireProjectRb.value = true; // Default selection
    
        // Add buttons with better layout
        var btnGroup = win.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = "center";
        btnGroup.spacing = 10;
        var okBtn = btnGroup.add("button", undefined, "OK");
        var closeBtn = btnGroup.add("button", undefined, "Close");
    
        // Make buttons fill the width
        okBtn.preferredSize.width = 80;
        closeBtn.preferredSize.width = 80;
        
        // Handle button clicks
        okBtn.onClick = function() {
            var scanOption;
            if (selectedLayerRb.value) scanOption = "selected";
            else if (currentCompRb.value) scanOption = "composition";
            else scanOption = "project";

            resetStatistics(); // Reset statistics before starting new upgrade
            
            app.beginUndoGroup("Upgrade Deep Glow Effects");
            upgradeDeepGlow(scanOption);
            app.endUndoGroup();
        }
        
        closeBtn.onClick = function() {
            win.close();
        }
    
        // Show the panel
        if (win instanceof Window) {
            win.show();
        } else {
            win.layout.layout(true);
        }
    
        return win;
    }
    
    // Call the main function
    showUI(this);
}