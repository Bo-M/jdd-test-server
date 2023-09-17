/*******************************************************************************
 *
 * Copyright 2015-2019 Zack Grossbart
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 ******************************************************************************/
'use strict';

// utilites
//
/**
 * Fixing typeof
 * takes value and returns type of value
 * @param  value
 * return typeof value
 */
function getType(value) {
    if ((function () { return value && (value !== this); }).call(value)) {
        //fallback on 'typeof' for truthy primitive values
        return typeof value;
    }
    return ({}).toString.call(value).match(/\s([a-z|A-Z]+)/)[1].toLowerCase();
}
/**
 * Iterate over array of objects and call given callback for each item in the array
 * Optionally may take this as scope
 *
 * @param array
 * @param callback
 * @param optional scope
 */
function forEach(array, callback, scope) {
    for (var idx = 0; idx < array.length; idx++) {
        callback.call(scope, array[idx], idx, array);
    }
}

/**
 * The jdd object handles all of the functions for the main page.  It finds the diffs and manages
 * the interactions of displaying them.
 */
/*global jdd:true */
var jdd = {

    LEFT: 'left',
    RIGHT: 'right',

    EQUALITY: 'eq',
    TYPE: 'type',
    MISSING: 'missing',
    diffs: [],
    SEPARATOR: '/',
    requestCount: 0,

    /**
     * Find the differences between the two objects and recurse into their sub objects.
     */
    findDiffs: function (/*Object*/ config1, /*Object*/ data1, /*Object*/ config2, /*Object*/ data2) {
        config1.currentPath.push(jdd.SEPARATOR);
        config2.currentPath.push(jdd.SEPARATOR);

        var key;
        // no un-used vars
        // var val;

        if (data1.length < data2.length) {
            /*
             * This means the second data has more properties than the first.
             * We need to find the extra ones and create diffs for them.
             */
            for (key in data2) {
                if (data2.hasOwnProperty(key)) {
                    // no un-used vars
                    // val = data1[key];
                    if (!data1.hasOwnProperty(key)) {
                        jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                            config2, jdd.generatePath(config2, jdd.SEPARATOR + key),
                            'The right side of this object has more items than the left side', jdd.MISSING));
                    }
                }
            }
        }

        /*
         * Now we're going to look for all the properties in object one and
         * compare them to object two
         */
        for (key in data1) {
            if (data1.hasOwnProperty(key)) {
                // no un-used vars
                // val = data1[key];

                config1.currentPath.push(key.replace(jdd.SEPARATOR, '#'));
                if (!data2.hasOwnProperty(key)) {
                    /*
                     * This means that the first data has a property which
                     * isn't present in the second data
                     */
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2),
                        'Missing property <code>' + key + '</code> from the object on the right side', jdd.MISSING));
                } else {
                    config2.currentPath.push(key.replace(jdd.SEPARATOR, '#'));

                    jdd.diffVal(data1[key], config1, data2[key], config2);
                    config2.currentPath.pop();
                }
                config1.currentPath.pop();
            }
        }

        config1.currentPath.pop();
        config2.currentPath.pop();

        /*
         * Now we want to look at all the properties in object two that
         * weren't in object one and generate diffs for them.
         */
        for (key in data2) {
            if (data2.hasOwnProperty(key)) {
                // no un-used vars
                // val = data1[key];

                if (!data1.hasOwnProperty(key)) {
                    jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                        config2, jdd.generatePath(config2, key),
                        'Missing property <code>' + key + '</code> from the object on the left side', jdd.MISSING));
                }
            }
        }
    },

    /**
     * Generate the differences between two values.  This handles differences of object
     * types and actual values.
     */
    diffVal: function (val1, config1, val2, config2) {

        if (getType(val1) === 'array') {
            jdd.diffArray(val1, config1, val2, config2);
        } else if (getType(val1) === 'object') {
            if (['array', 'string', 'number', 'boolean', 'null'].indexOf(getType(val2)) > -1) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be objects', jdd.TYPE));
            } else {
                jdd.findDiffs(config1, val1, config2, val2);
            }
        } else if (getType(val1) === 'string') {
            if (getType(val2) !== 'string') {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be strings', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal strings', jdd.EQUALITY));
            }
        } else if (getType(val1) === 'number') {
            if (getType(val2) !== 'number') {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both types should be numbers', jdd.TYPE));
            } else if (val1 !== val2) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'Both sides should be equal numbers', jdd.EQUALITY));
            }
        } else if (getType(val1) === 'boolean') {
            jdd.diffBool(val1, config1, val2, config2);
        } else if (getType(val1) === 'null' && getType(val2) !== 'null') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be nulls', jdd.TYPE));
        }
    },

    /**
     * Arrays are more complex because we need to recurse into them and handle different length
     * issues so we handle them specially in this function.
     */
    diffArray: function (val1, config1, val2, config2) {
        if (getType(val2) !== 'array') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be arrays', jdd.TYPE));
            return;
        }

        if (val1.length < val2.length) {
            /*
             * Then there were more elements on the right side and we need to
             * generate those differences.
             */
            for (var i = val1.length; i < val2.length; i++) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2, '[' + i + ']'),
                    'Missing element <code>' + i + '</code> from the array on the left side', jdd.MISSING));
            }
        }
        val1.forEach(function (arrayVal, index) {
            if (val2.length <= index) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1, '[' + index + ']'),
                    config2, jdd.generatePath(config2),
                    'Missing element <code>' + index + '</code> from the array on the right side', jdd.MISSING));
            } else {
                config1.currentPath.push(jdd.SEPARATOR + '[' + index + ']');
                config2.currentPath.push(jdd.SEPARATOR + '[' + index + ']');

                if (getType(val2) === 'array') {
                    /*
                     * If both sides are arrays then we want to diff them.
                     */
                    jdd.diffVal(val1[index], config1, val2[index], config2);
                }
                config1.currentPath.pop();
                config2.currentPath.pop();
            }
        });
    },

    /**
     * We handle boolean values specially because we can show a nicer message for them.
     */
    diffBool: function (val1, config1, val2, config2) {
        if (getType(val2) !== 'boolean') {
            jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                config2, jdd.generatePath(config2),
                'Both types should be booleans', jdd.TYPE));
        } else if (val1 !== val2) {
            if (val1) {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>true</code> and the right side is <code>false</code>', jdd.EQUALITY));
            } else {
                jdd.diffs.push(jdd.generateDiff(config1, jdd.generatePath(config1),
                    config2, jdd.generatePath(config2),
                    'The left side is <code>false</code> and the right side is <code>true</code>', jdd.EQUALITY));
            }
        }
    },

    /**
     * Format the object into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorate: function (/*Object*/ config, /*Object*/ data) {
        if (getType(data) === 'array') {
            jdd.formatAndDecorateArray(config, data);
            return;
        }

        jdd.startObject(config);
        config.currentPath.push(jdd.SEPARATOR);

        var props = jdd.getSortedProperties(data);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */
        props.forEach(function (key) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '"' + jdd.unescapeString(key) + '": ';
            config.currentPath.push(key.replace(jdd.SEPARATOR, '#'));
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
            jdd.formatVal(data[key], config);
            config.currentPath.pop();
        });

        jdd.finishObject(config);
        config.currentPath.pop();
    },

    /**
     * Format the array into the output stream and decorate the data tree with
     * the data about this object.
     */
    formatAndDecorateArray: function (/*Object*/ config, /*Array*/ data) {
        jdd.startArray(config);

        /*
         * If the first set has more than the second then we will catch it
         * when we compare values.  However, if the second has more then
         * we need to catch that here.
         */
        data.forEach(function (arrayVal, index) {
            config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
            config.paths.push({
                path: jdd.generatePath(config, '[' + index + ']'),
                line: config.line
            });

            config.currentPath.push(jdd.SEPARATOR + '[' + index + ']');
            jdd.formatVal(arrayVal, config);
            config.currentPath.pop();
        });

        jdd.finishArray(config);
        config.currentPath.pop();
    },

    /**
     * Generate the start of the an array in the output stream and push in the new path
     */
    startArray: function (config) {
        config.indent++;
        config.out += '[';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the array and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the array, outdent, and pop off all the path
     */
    finishArray: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Generate the start of the an object in the output stream and push in the new path
     */
    startObject: function (config) {
        config.indent++;
        config.out += '{';

        if (config.paths.length === 0) {
            /*
             * Then we are at the top of the object and we want to add
             * a path for it.
             */
            config.paths.push({
                path: jdd.generatePath(config),
                line: config.line
            });
        }

        if (config.indent === 0) {
            config.indent++;
        }
    },

    /**
     * Finish the object, outdent, and pop off all the path
     */
    finishObject: function (config) {
        if (config.indent === 0) {
            config.indent--;
        }

        jdd.removeTrailingComma(config);

        config.indent--;
        config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + '}';
        if (config.indent !== 0) {
            config.out += ',';
        } else {
            config.out += jdd.newLine(config);
        }
    },

    /**
     * Format a specific value into the output stream.
     */
    formatVal: function (val, config) {
        if (getType(val) === 'array') {
            config.out += '[';

            config.indent++;
            val.forEach(function (arrayVal, index) {
                config.out += jdd.newLine(config) + jdd.getTabs(config.indent);
                config.paths.push({
                    path: jdd.generatePath(config, '[' + index + ']'),
                    line: config.line
                });

                config.currentPath.push(jdd.SEPARATOR + '[' + index + ']');
                jdd.formatVal(arrayVal, config);
                config.currentPath.pop();
            });
            jdd.removeTrailingComma(config);
            config.indent--;

            config.out += jdd.newLine(config) + jdd.getTabs(config.indent) + ']' + ',';
        } else if (getType(val) === 'object') {
            jdd.formatAndDecorate(config, val);
        } else if (getType(val) === 'string') {
            config.out += '"' + jdd.unescapeString(val) + '",';
        } else if (getType(val) === 'number') {
            config.out += val + ',';
        } else if (getType(val) === 'boolean') {
            config.out += val + ',';
        } else if (getType(val) === 'null') {
            config.out += 'null,';
        }
    },

    /**
     * When we parse the JSON string we end up removing the escape strings when we parse it
     * into objects.  This results in invalid JSON if we insert those strings back into the
     * generated JSON.  We also need to look out for characters that change the line count
     * like new lines and carriage returns.
     *
     * This function puts those escaped values back when we generate the JSON output for the
     * well known escape strings in JSON.  It handles properties and values.
     *
     * This function does not handle unicode escapes.  Unicode escapes are optional in JSON
     * and the JSON output is still valid with a unicode character in it.
     */
    unescapeString: function (val) {
        if (val) {
            return val.replace('\\', '\\\\')    // Single slashes need to be replaced first
                .replace(/\"/g, '\\"')     // Then double quotes
                .replace(/\n/g, '\\n')     // New lines
                .replace('\b', '\\b')      // Backspace
                .replace(/\f/g, '\\f')     // Formfeed
                .replace(/\r/g, '\\r')     // Carriage return
                .replace(/\t/g, '\\t');    // Horizontal tabs
        } else {
            return val;
        }
    },

    /**
     * Generate a JSON path based on the specific configuration and an optional property.
     */
    generatePath: function (config, prop) {
        var s = '';
        config.currentPath.forEach(function (path) {
            s += path;
        });

        if (prop) {
            s += jdd.SEPARATOR + prop.replace(jdd.SEPARATOR, '#');
        }

        if (s.length === 0) {
            return jdd.SEPARATOR;
        } else {
            return s;
        }
    },

    /**
     * Add a new line to the output stream
     */
    newLine: function (config) {
        config.line++;
        return '\n';
    },

    /**
     * Sort all the relevant properties and return them in an alphabetical sort by property key
     */
    getSortedProperties: function (/*Object*/ obj) {
        var props = [];

        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                props.push(prop);
            }
        }

        props = props.sort(function (a, b) {
            return a.localeCompare(b);
        });

        return props;
    },

    /**
     * Generate the diff and verify that it matches a JSON path
     */
    generateDiff: function (config1, path1, config2, path2, /*String*/ msg, type) {
        if (path1 !== jdd.SEPARATOR && path1.charAt(path1.length - 1) === jdd.SEPARATOR) {
            path1 = path1.substring(0, path1.length - 1);
        }

        if (path2 !== jdd.SEPARATOR && path2.charAt(path2.length - 1) === jdd.SEPARATOR) {
            path2 = path2.substring(0, path2.length - 1);
        }
        var pathObj1 = config1.paths.find(function (path) {
            return path.path === path1;
        });
        var pathObj2 = config2.paths.find(function (path) {
            return path.path === path2;
        });

        if (!pathObj1) {
            throw 'Unable to find line number for (' + msg + '): ' + path1;
        }

        if (!pathObj2) {
            throw 'Unable to find line number for (' + msg + '): ' + path2;
        }

        return {
            path1: pathObj1,
            path2: pathObj2,
            type: type,
            msg: msg
        };
    },

    /**
     * Get the current indent level
     */
    getTabs: function (/*int*/ indent) {
        var s = '';
        for (var i = 0; i < indent; i++) {
            s += '    ';
        }

        return s;
    },

    /**
     * Remove the trailing comma from the output.
     */
    removeTrailingComma: function (config) {
        /*
         * Remove the trailing comma
         */
        if (config.out.charAt(config.out.length - 1) === ',') {
            config.out = config.out.substring(0, config.out.length - 1);
        }
    },

    /**
     * Create a config object for holding differences
     */
    createConfig: function () {
        return {
            out: '',
            indent: -1,
            currentPath: [],
            paths: [],
            line: 1
        };
    },

    /**
     * Format the output pre tags.
     */
    formatPRETags: function (parityLinesColumnsLeftRight, parityLinesColumnsRightLeft) {
        forEach($('pre'), function (pre) {
            var lineNumbers = '<div class="gutter">'
            var codeLines = '<div>'

            // This is used to encode text as fast as possible
            var lineDiv = document.createElement('div')
            var lineText = document.createTextNode('')
            lineDiv.appendChild(lineText)

            var addLine = function (line, index) {
                if (pre.className == "codeBlock left") {
                    var leftColumnNumber = index + 1
                    var rightColumnNumber = parityLinesColumnsLeftRight[leftColumnNumber]
                } else {
                    var rightColumnNumber = index + 1
                    var leftColumnNumber = parityLinesColumnsRightLeft[rightColumnNumber]
                }
                if (rightColumnNumber == undefined || leftColumnNumber == undefined) {
                    leftColumnNumber = undefined
                    rightColumnNumber = undefined
                }
                if (leftColumnNumber) {
                    lineNumbers += 
                        '<span class="line-number" style="background-color: #f0f4ec; color: #888" onclick="hide_until_line(' + 
                        leftColumnNumber + 
                        ', ' + 
                        rightColumnNumber + 
                        ') ; return false">' + (index + 1) + ".</span>";
                }
                else {
                    lineNumbers += '<span class="line-number">' + (index + 1) + ".</span>";
                }
              lineText.nodeValue = line

              codeLines +=
                '<div class="codeLine line' +
                (index + 1) +
                '"><span class="code">' +
                lineDiv.innerHTML +
                "</span></div>";
            };

            var lines = $(pre).text().split('\n');
            lines.forEach(addLine);

            // Combine it all together
            codeLines += '</div>'
            lineNumbers += '</div>'

            var codeBlockElement = $(
              '<pre class="codeBlock">' + lineNumbers + codeLines + "</pre>"
            );

            codeBlockElement.addClass($(pre).attr('class'));
            codeBlockElement.attr('id', $(pre).attr('id'));

            $(pre).replaceWith(codeBlockElement);
        });
    },

    /**
     * Format the text edits which handle the JSON input
     */
    formatTextAreas: function () {
        forEach($('textarea'), function (textarea) {
            var codeBlock = $('<div class="codeBlock"></div>');
            var lineNumbers = $('<div class="gutter"></div>');
            codeBlock.append(lineNumbers);

            var addLine = function (line, index) {
                lineNumbers.append($('<span class="line-number">' + (index + 1) + '.</span>'));
            };

            var lines = $(textarea).val().split('\n');
            lines.forEach(addLine);

            $(textarea).replaceWith(codeBlock);
            codeBlock.append(textarea);
        });
    },

    handleDiffClick: function (line, side) {
        var diffs = jdd.diffs.filter(function (diff) {
            if (side === jdd.LEFT) {
                return line === diff.path1.line;
            } else if (side === jdd.RIGHT) {
                return line === diff.path2.line;
            } else {
                return line === diff.path1.line || line === diff.path2.line;
            }
        });

        $('pre.left span.code').removeClass('selected');
        $('pre.right span.code').removeClass('selected');
        $('ul.toolbar').text('');
        diffs.forEach(function (diff) {
            $('pre.left div.line' + diff.path1.line + ' span.code').addClass('selected');
            $('pre.right div.line' + diff.path2.line + ' span.code').addClass('selected');
        });

        if (side === jdd.LEFT || side === jdd.RIGHT) {
            jdd.currentDiff = jdd.diffs.findIndex(function (diff) {
                return diff.path1.line === line;
            });
        }

        if (jdd.currentDiff === -1) {
            jdd.currentDiff = jdd.diffs.findIndex(function (diff) {
                return diff.path2.line === line;
            });
        }

        var buttons = $('<div id="buttons"><div>');
        var prev = $('<a href="#" title="Previous difference" id="prevButton">&lt;</a>');
        prev.addClass('disabled');
        prev.click(function (e) {
            e.preventDefault();
            jdd.highlightPrevDiff();
        });
        buttons.append(prev);

        buttons.append('<span id="prevNextLabel"></span>');

        var next = $('<a href="#" title="Next difference" id="nextButton">&gt;</a>');
        next.click(function (e) {
            e.preventDefault();
            jdd.highlightNextDiff();
        });
        buttons.append(next);

        $('ul.toolbar').append(buttons);
        jdd.updateButtonStyles();

        jdd.showDiffDetails(diffs);
    },

    highlightPrevDiff: function () {
        if (jdd.currentDiff > 0) {
            jdd.currentDiff--;
            jdd.highlightDiff(jdd.currentDiff);
            jdd.scrollToDiff(jdd.diffs[jdd.currentDiff]);

            jdd.updateButtonStyles();
        }
    },

    highlightNextDiff: function () {
        if (jdd.currentDiff < jdd.diffs.length - 1) {
            jdd.currentDiff++;
            jdd.highlightDiff(jdd.currentDiff);
            jdd.scrollToDiff(jdd.diffs[jdd.currentDiff]);

            jdd.updateButtonStyles();
        }
    },

    updateButtonStyles: function () {
        $('#prevButton').removeClass('disabled');
        $('#nextButton').removeClass('disabled');

        $('#prevNextLabel').text((jdd.currentDiff + 1) + ' of ' + (jdd.diffs.length));

        if (jdd.currentDiff === 1) {
            $('#prevButton').addClass('disabled');
        } else if (jdd.currentDiff === jdd.diffs.length - 1) {
            $('#nextButton').addClass('disabled');
        }
    },

    /**
     * Highlight the diff at the specified index
     */
    highlightDiff: function (index) {
        jdd.handleDiffClick(jdd.diffs[index].path1.line, jdd.BOTH);
    },

    /**
     * Show the details of the specified diff
     */
    showDiffDetails: function (diffs) {
        diffs.forEach(function (diff) {
            var li = $('<li></li>');
            li.html(diff.msg);
            $('ul.toolbar').append(li);

            li.click(function () {
                jdd.scrollToDiff(diff);
            });

        });
    },

    /**
     * Scroll the specified diff to be visible
     */
    scrollToDiff: function (diff) {
        $('html, body').animate({
            scrollTop: $('pre.left div.line' + diff.path1.line + ' span.code').offset().top
        }, 0);
    },

    /**
     * Process the specified diff
     */
    processDiffs: function () {
        var left = [];
        var right = [];

        // Cache the lines for fast lookup
        var leftLineLookup = {}
        var rightLineLookup = {}

        // We can use the index to save lookup up the parents class
        $('pre.left span.code').each(function(index) {
            leftLineLookup[index + 1] = $(this)
        })

        $('pre.right span.code').each(function(index) {
            rightLineLookup[index + 1] = $(this)
        })

        jdd.diffs.forEach(function (diff) {
            leftLineLookup[diff.path1.line].addClass(diff.type).addClass('diff');
            if (left.indexOf(diff.path1.line) === -1) {
                leftLineLookup[diff.path1.line].click(function () {
                    jdd.handleDiffClick(diff.path1.line, jdd.LEFT);
                });
                left.push(diff.path1.line);
            }

            rightLineLookup[diff.path2.line].addClass(diff.type).addClass('diff');
            if (right.indexOf(diff.path2.line) === -1) {
                rightLineLookup[diff.path2.line].click(function () {
                    jdd.handleDiffClick(diff.path2.line, jdd.RIGHT);
                });
                right.push(diff.path2.line);
            }
        });

        jdd.diffs = jdd.diffs.sort(function (a, b) {
            return a.path1.line - b.path1.line;
        });

    },

    /**
     * Validate the input against the JSON parser
     */
    validateInput: function (json, side) {
        try {
            jsl.parser.parse(json);

            if (side === jdd.LEFT) {
                $('#errorLeft').text('').hide();
                $('#textarealeft').removeClass('error');
            } else {
                $('#errorRight').text('').hide();
                $('#textarearight').removeClass('error');
            }

            return true;
        } catch (parseException) {
            if (side === jdd.LEFT) {
                $('#errorLeft').text(parseException.message).show();
                $('#textarealeft').addClass('error');
            } else {
                $('#errorRight').text(parseException.message).show();
                $('#textarearight').addClass('error');
            }
            return false;
        }
    },

    /**
     * Handle the file uploads
     */
    handleFiles: function (files, side) {
        var reader = new FileReader();

        reader.onload = (function () {
            return function (e) {
                if (side === jdd.LEFT) {
                    $('#textarealeft').val(e.target.result);
                } else {
                    $('#textarearight').val(e.target.result);
                }
            };
        })(files[0]);

        reader.readAsText(files[0]);
    },

    setupNewDiff: function () {
        $('div.initContainer').show();
        $('div.diffcontainer').hide();
        $('div.diffcontainer pre').text('');
        $('ul.toolbar').text('');
    },

    /**
     * Generate the report section with the diff
     */
    generateReport: function () {
        var report = $('#report');

        report.text('');

        var newDiff = $('<button>Perform a new diff</button>');
        report.append(newDiff);
        newDiff.click(function () {
            jdd.setupNewDiff();
        });

        if (jdd.diffs.length === 0) {
            report.append('<span>The two files were semantically  identical.</span>');
            return;
        }

        var typeCount = 0;
        var eqCount = 0;
        var missingCount = 0;
        jdd.diffs.forEach(function (diff) {
            if (diff.type === jdd.EQUALITY) {
                eqCount++;
            } else if (diff.type === jdd.MISSING) {
                missingCount++;
            } else if (diff.type === jdd.TYPE) {
                typeCount++;
            }
        });

        var title = $('<div class="reportTitle"></div>');
        if (jdd.diffs.length === 1) {
            title.text('Found ' + (jdd.diffs.length) + ' difference');
        } else {
            title.text('Found ' + (jdd.diffs.length) + ' differences');
        }

        report.prepend(title);

        var filterBlock = $('<span class="filterBlock">Show:</span>');

        /*
         * The missing checkbox
         */
        if (missingCount > 0) {
            var missing = $('<label><input id="showMissing" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (missingCount === 1) {
                missing.append(missingCount + ' missing property');
            } else {
                missing.append(missingCount + ' missing properties');
            }
            missing.children('input').click(function () {
                if (!$(this).prop('checked')) {
                    $('span.code.diff.missing').addClass('missing_off').removeClass('missing');
                } else {
                    $('span.code.diff.missing_off').addClass('missing').removeClass('missing_off');
                }
            });
            filterBlock.append(missing);
        }

        /*
         * The types checkbox
         */
        if (typeCount > 0) {
            var types = $('<label><input id="showTypes" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (typeCount === 1) {
                types.append(typeCount + ' incorrect type');
            } else {
                types.append(typeCount + ' incorrect types');
            }

            types.children('input').click(function () {
                if (!$(this).prop('checked')) {
                    $('span.code.diff.type').addClass('type_off').removeClass('type');
                } else {
                    $('span.code.diff.type_off').addClass('type').removeClass('type_off');
                }
            });
            filterBlock.append(types);
        }

        /*
         * The equals checkbox
         */
        if (eqCount > 0) {
            var eq = $('<label><input id="showEq" type="checkbox" name="checkbox" value="value" checked="true"></label>');
            if (eqCount === 1) {
                eq.append(eqCount + ' unequal value');
            } else {
                eq.append(eqCount + ' unequal values');
            }
            eq.children('input').click(function () {
                if (!$(this).prop('checked')) {
                    $('span.code.diff.eq').addClass('eq_off').removeClass('eq');
                } else {
                    $('span.code.diff.eq_off').addClass('eq').removeClass('eq_off');
                }
            });
            filterBlock.append(eq);
        }

        report.append(filterBlock);


    },

    /**
     * Implement the compare button and complete the compare process
     */
    compare: function () {

        if (jdd.requestCount !== 0) {
            /*
             * This means we have a pending request and we just need to wait for that to finish.
             */
            return;
        }

        $('body').addClass('progress');
        $('#compare').prop('disabled', true);
        // Save requests URL
        var area_url = function (id) {
            if ($('#' + id).val().trim().substring(0, 4).toLowerCase() === 'http') {
                return $('#' + id).val().trim()
            }
        }
        //window.request_content = ''
        var left_url = area_url('textarealeft')
        if (left_url) {
            window.left_url = left_url
        }
        var right_url = area_url('textarearight')
        if (right_url) {
            window.right_url = right_url
        }

        var loadUrl = function (id, errId) {
            if ($('#' + id).val().trim().substring(0, 4).toLowerCase() === 'http') {
                jdd.requestCount++;
                $.post('http://0.0.0.0:5001/proxy',
                    {
                        'url': $('#' + id).val().trim()
                    }, function (responseObj) {
                        // Show request object at the top of screen
                        if (responseObj.requestContent.length > 1){
                            // TODO window.request_content = JSON.parse(responseObj.requestContent.replace(/^.*[,\n ]+"use_proxy.*$/mg, ""))
                            window.request_content = JSON.parse(responseObj.requestContent)
                            $('#requestContainerCenter').val(responseObj.requestContent);
                        }
                        if (responseObj.error) {
                            $('#' + errId).text(responseObj.result).show();
                            $('#' + id).addClass('error');
                            $('body').removeClass('progress');
                            $('#compare').prop('disabled', false);
                        } else {
                            $('#' + id).val(responseObj.content);
                            jdd.requestCount--;
                            jdd.compare();
                        }
                    }, 'json');
                return true;
            } else {
                return false;
            }
        };

        if (loadUrl('textarealeft', 'errorLeft')) {
            return;
        }

        if (loadUrl('textarearight', 'errorRight')) {
            return;
        }

        /*
         * We'll start by running the text through JSONlint since it gives
         * much better error messages.
         */
        var leftValid = jdd.validateInput($('#textarealeft').val(), jdd.LEFT);
        var rightValid = jdd.validateInput($('#textarearight').val(), jdd.RIGHT);

        if (!leftValid || !rightValid) {
            $('body').removeClass('progress');
            $('#compare').prop('disabled', false);
            return;
        }

        $('div.initContainer').hide();

        jdd.diffs = [];

        var left = JSON.parse($('#textarealeft').val());
        var right = JSON.parse($('#textarearight').val());


        var config = jdd.createConfig();
        jdd.formatAndDecorate(config, left);
        $('#out').text(config.out);

        var config2 = jdd.createConfig();
        jdd.formatAndDecorate(config2, right);
        $('#out2').text(config2.out);
        
        var findLineBasedOnPath = function (config, path_value) {
            for (let i = 0; i < config.paths.length; i++) {
                if (config.paths[i].path == path_value) {
                    return config.paths[i].line
                }
            }
        }
        var findPathBasedOnLine = function (config, line_value) {
            for (let i = 0; i < config.paths.length; i++) {
                if (config.paths[i].line == line_value) {
                    return config.paths[i].path
                }
            }
        }
        
        function getElementsByXPath(xpath, parent) {
            // Find all elements based on xpath and return as array this is used when we need to find elements by text
            let results = [];
            let query = document.evaluate(xpath, parent || document,
                null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0, length = query.snapshotLength; i < length; ++i) {
                results.push(query.snapshotItem(i));
            }
            return results;
        }

        var parityLinesColumnsLeftRight = {}
        var parityLinesColumnsRightLeft = {}
        for (let i = 0; i < config.paths.length; i++) {
            var c2Line = findLineBasedOnPath(config2, config.paths[i].path)
            parityLinesColumnsLeftRight[config.paths[i].line] = c2Line
            parityLinesColumnsRightLeft[c2Line] = config.paths[i].line
        }
        jdd.formatPRETags(parityLinesColumnsLeftRight, parityLinesColumnsRightLeft);

        config.currentPath = [];
        config2.currentPath = [];

        jdd.diffVal(left, config, right, config2);
        jdd.processDiffs();
        jdd.generateReport();

        $('div.diffcontainer').show();

        //console.log('diffs: ' + JSON.stringify(jdd.diffs));

        if (jdd.diffs.length > 0) {
            jdd.highlightDiff(0);
            jdd.currentDiff = 0;
            jdd.updateButtonStyles();
        }

        $('body').removeClass('progress');
        $('#compare').prop('disabled', false);

        /*  THIS IS ADDED */
        
        // TODO maybe add check if all file_id can be downloaded, but it should be alright since we are checking for files_count and that should mean it is "uploaded"
        
        // Find all lines that are different
        var diff_elms = $('pre.left div > span.eq')
        var python_server_static_files_path = 'http://127.0.0.1:5001/static_pdf_png_files'
        for (let i = 0; i < diff_elms.length; i++) {
            var left_side_element_text = diff_elms[i].innerText
            // convert line string to number
            var line = Number(diff_elms[i].parentElement.classList[1].replace('line', ''))
            var leftSidePath = findPathBasedOnLine(config, line)
            var right_side_element_line = findLineBasedOnPath(config2, leftSidePath)
            var right_side_element_text = $('pre.right div.line' + right_side_element_line + ' > span')[0].innerText

            // don't try to show diff for list of file_id
            if (left_side_element_text.split('"').length > 1) {
                var matched = left_side_element_text.split('"')[1].match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
                var is_file_id = false
                if (matched && matched.length > 0) {
                    var img_url = window.left_url.substring(0, window.left_url.lastIndexOf('/')) + '/' + left_side_element_text.split('"')[1] + '.png'
                    img_url = '/definitions' + img_url.split('/definitions')[1]
                    diff_elms[i].innerHTML = 
                        '<span>' + 
                        diff_elms[i].innerText + 
                        '</span><span>        </span><span class="show-button" onclick="full_view_src(\'' + img_url + '\')">show img</span>'
                    
                    is_file_id = true
                }
                var matched = right_side_element_text.split('"')[1].match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
                if (matched && matched.length > 0) {
                    var img_url = window.right_url.substring(0, window.right_url.lastIndexOf('/')) + '/' + right_side_element_text.split('"')[1] + '.png'
                    img_url = python_server_static_files_path + '/brobot_bots' + img_url.split('/brobot_bots')[1]
                    img_url = img_url.replace('downloads', 'screenshots')
                    $('pre.right div.line' + right_side_element_line + ' > span')[0].innerHTML = 
                        '<span>' + 
                        right_side_element_text + 
                        '</span><span>        </span><span class="show-button" onclick="full_view_src(\'' + img_url + '\')">show img</span>'
                    
                    is_file_id = true
                }
                if (left_side_element_text.includes("file_id") == true && right_side_element_text.includes("file_id") == false) {
                    var pdf_url = window.left_url.substring(0, window.left_url.lastIndexOf('/')) + '/' + left_side_element_text.split('"')[3] + '.pdf'
                    pdf_url = '/definitions' + pdf_url.split('/definitions')[1]
                    diff_elms[i].innerHTML =
                        '<span>' +
                        diff_elms[i].innerText +
                        `</span><span>        </span><span class="show-button" onclick="full_view_pdf('${pdf_url}', '')">show PDF</span>`

                    is_file_id = true
                }

                if (right_side_element_text.includes("file_id") == true && left_side_element_text.includes("file_id") == false) {
                    var pdf_url = window.right_url.substring(0, window.right_url.lastIndexOf('/')) + '/' + right_side_element_text.split('"')[3] + '.pdf'
                    pdf_url = python_server_static_files_path + '/brobot_bots' + pdf_url.split('/brobot_bots')[1]
                    $('pre.right div.line' + right_side_element_line + ' > span')[0].innerHTML =
                        '<span>' +
                        right_side_element_text +
                        `</span><span>        </span><span class="show-button" onclick="full_view_pdf('', '${pdf_url}')">show PDF</span>`

                    is_file_id = true
                }
                if (left_side_element_text.includes("file_id") == true && right_side_element_text.includes("file_id") == true) {
                    var left_pdf_url = window.left_url.substring(0, window.left_url.lastIndexOf('/')) + '/' + left_side_element_text.split('"')[3] + '.pdf'
                    left_pdf_url = '/definitions' + left_pdf_url.split('/definitions')[1]
                    //
                    var right_pdf_url = window.right_url.substring(0, window.right_url.lastIndexOf('/')) + '/' + right_side_element_text.split('"')[3] + '.pdf'
                    right_pdf_url = python_server_static_files_path + '/brobot_bots' + right_pdf_url.split('/brobot_bots')[1]
                    // left column
                    diff_elms[i].innerHTML =
                        '<span>' +
                        diff_elms[i].innerText +
                        `</span><span>        </span><span class="show-button"" onclick="full_view_pdf('${left_pdf_url}', '${right_pdf_url}')">show PDF</span>`

                    // right column
                    $('pre.right div.line' + right_side_element_line + ' > span')[0].innerHTML =
                        '<span>' +
                        right_side_element_text +
                        `</span><span>        </span><span class="show-button" onclick="full_view_pdf('${left_pdf_url}', '${right_pdf_url}')">show PDF</span>`
                    is_file_id = true
                }

                if (is_file_id === true){
                    continue
                }
            }

            // Find diff using jsdiff: https://github.com/kpdecker/jsdiff
            var text_diff = Diff.diffChars(left_side_element_text, right_side_element_text, {ignoreCase: true})

            // Format output elements to just show differences between text
            var left_column_node = ''
            var right_column_node = ''
            for (var j=0; j < text_diff.length; j++) {
                // If diff is space or dash in that case we are highlighting background so it is noticable
                var style = 'color: #c00;'
                if (text_diff[j].value == ' ' || text_diff[j].value == '-') {
                    style = 'color: #fff; background-color: #c00;'
                }
                if (text_diff[j].added) {
                    right_column_node += 
                        '<span style="' + style + '">' + 
                        text_diff[j].value + 
                        '</span>'
                } else if (text_diff[j].removed) {
                    left_column_node += 
                        '<span style="' + style + '">' + 
                        text_diff[j].value + 
                        '</span>'
                } else {
                    var unchanged_span = '<span>' + text_diff[j].value + '</span>'
                    right_column_node += unchanged_span
                    left_column_node += unchanged_span
                }
            }
            diff_elms[i].innerHTML = left_column_node
            $('pre.right div.line' + right_side_element_line + ' > span')[0].innerHTML = right_column_node
        }

        // This is if there isn't a matching file in test case / resulting data_collected, so we can show those files also
        var notComparedFileIds = getElementsByXPath("//span[contains(text(),'file_id')]/parent::div")
        for (let i = 0; i < notComparedFileIds.length; i++) {
            if (notComparedFileIds[i].parentElement.parentElement.className.includes('left')) {
                var pdf_url = window.left_url.substring(0, window.left_url.lastIndexOf('/')) + '/' + notComparedFileIds[i].innerText.split('"')[3] + '.pdf'
                pdf_url = '/definitions' + pdf_url.split('/definitions')[1]
                var parameters = `'${pdf_url}', ''`
            }
            else {
                var pdf_url = window.right_url.substring(0, window.right_url.lastIndexOf('/')) + '/' + notComparedFileIds[i].innerText.split('"')[3] + '.pdf'
                if (pdf_url.includes('brobot_bots') == true) {
                    pdf_url = python_server_static_files_path + '/brobot_bots' + pdf_url.split('/brobot_bots')[1]
                }
                else {
                    pdf_url = python_server_static_files_path  + pdf_url.split('cache_static_files')[1]
                }
                var parameters = `'', '${pdf_url}'`
            }

            notComparedFileIds[i].innerHTML =
                '<span>' +
                notComparedFileIds[i].innerText +
                `</span><span>        </span><span class="show-button" onclick="full_view_pdf(${parameters})">show PDF</span>`
        }

        // Highlight elapsed_time_seconds from stats field
        var matchingElement = document.evaluate("//span[contains(text(),'elapsed_time_seconds')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        if (matchingElement){
            matchingElement.innerHTML = 
                '<span>' + 
                matchingElement.innerText.split(':')[0] + 
                ':</span>' + 
                '<span style="background-color: #00c; color: #fff">' + 
                matchingElement.innerText.split(':')[1] + 
                '</span>'
            }

        // As if there is different number of screenshot for left-right column it wont be treated as diff, 
        //  it will be treated as missing elements and this way we are checking first 30 rows to see if there is screenshot file_id
        // TODO this probably wont work for comprovante_de_accesso PDF files, so that will need to be checked
        var columnsSel = ['pre.left div.line', 'pre.right div.line']
        for (var i = 0; i < 2; i++) {
            if (window.request_content.capture_screenshot != true) {
                continue
            }
            for (var j = 1; j < 30; j++) {
                var el = $(columnsSel[i] + j + ' > span')
                if (el[0] == undefined) {
                    continue
                }
                if (el[0].innerText.split('"').length < 3 || el[0].innerText.includes('show img')) {
                    continue
                }
                var matched = el[0].innerText.split('"')[1].match(/^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
                if (matched && matched.length > 0) {
                    if (columnsSel[i].includes('left')) {
                        var img_url = window.left_url.substring(0, window.left_url.lastIndexOf('/')) + '/' + el[0].innerText.split('"')[1] + '.png'
                        img_url = '/definitions' + img_url.split('/definitions')[1]
                    }
                    else {
                        var img_url = window.right_url.substring(0, window.right_url.lastIndexOf('/')) + '/' + el[0].innerText.split('"')[1] + '.png'
                        img_url = python_server_static_files_path + '/brobot_bots' + img_url.split('/brobot_bots')[1]
                        img_url = img_url.replace('downloads', 'screenshots')

                    }
                    el[0].innerHTML =
                        '<span>' +
                        el[0].innerText +
                        '</span><span>        </span><span class="show-button" onclick="full_view_src(\'' + img_url + '\')">show img</span>'

                }
            }
        }
        //
        // Add event for horizontal scroll for both columns, 
        // so when 1 column is scrolled it will scroll other column automatically
        // Just like comparing differences in VSCode
        var horizontal_scroll = function (e, connected_column) {
            var current_scroll_pos = e.currentTarget.scrollLeft;
            var max_scroll_pos = $(connected_column).width();
            if (current_scroll_pos > max_scroll_pos) {
                current_scroll_pos = max_scroll_pos
            }
            $(connected_column).scrollLeft(current_scroll_pos);
        }

        $('pre.right').on("scroll", function (e) {
            horizontal_scroll(e, 'pre.left')
            });
        
        $('pre.left').on("scroll", function (e) {
            horizontal_scroll(e, 'pre.right')
            });
        if ((left.scrape_id == right.scrape_id && right.scrape_id == window.request_content.scrape_id) == false && window.left_url.includes('empty_response.json') == false){
            alert("scrape_id is not the same for all 3 files, please check if all files are for same test")
        }

        // check if number of unique file_id is the same as files_count
        var fileIds = getElementsByXPath("//pre[contains(@class,'right')]//span[contains(text(),'file_id')]")
        let files = [];
        for (let i = 0; i < fileIds.length; i++) {
            files.push(fileIds[i].innerText.split('"')[3]);
        }
        var uniqueFileIds = [...new Set(files)];
        if (uniqueFileIds.length != right.files_count) {
            alert(`Number of unique file_id(s): ${uniqueFileIds.length} in data_collected don't match number in files_count: ${right.files_count} `)
        }

        /* End of added code     */
        /*
         * We want to switch the toolbar bar between fixed and absolute position when you
         * scroll so you can get the maximum number of toolbar items.
         */
        var toolbarTop = $('#toolbar').offset().top - 15;
        $(window).scroll(function () {
            if (toolbarTop < $(window).scrollTop()) {
                $('#toolbar').css('position', 'fixed').css('top', '10px');
            } else {
                $('#toolbar').css('position', 'absolute').css('top', '');
            }
        });

    },

    /**
     * Load in the sample data
     */
    loadSampleData: function () {
        $('#textarealeft').val('{"Aidan Gillen": {"array": ["Game of Thron\\"es","The Wire"],"string": "some string","int": 2,"aboolean": true, "boolean": true,"object": {"foo": "bar","object1": {"new prop1": "new prop value"},"object2": {"new prop1": "new prop value"},"object3": {"new prop1": "new prop value"},"object4": {"new prop1": "new prop value"}}},"Amy Ryan": {"one": "In Treatment","two": "The Wire"},"Annie Fitzgerald": ["Big Love","True Blood"],"Anwan Glover": ["Treme","The Wire"],"Alexander Skarsgard": ["Generation Kill","True Blood"], "Clarke Peters": null}');
        /*$('#textarealeft').val('[{  "OBJ_ID": "CN=Kate Smith,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "b3067a77-875b-4208-9ee3-39128adeb654",  "lastLogon": "0",  "sAMAccountName": "ksmith",  "userPrincipalName": "ksmith@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Kate Smith,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"},{  "OBJ_ID": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "c3f7dae9-9b4f-4d55-a1ec-bf9ef45061c3",  "lastLogon": "130766915788304915",  "sAMAccountName": "tswan",  "userPrincipalName": "tswan@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"}]');
        $('#textarearight').val('{"foo":[{  "OBJ_ID": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com",  "userAccountControl": "512",  "objectGUID": "c3f7dae9-9b4f-4d55-a1ec-bf9ef45061c3",  "lastLogon": "130766915788304915",  "sAMAccountName": "tswan",  "userPrincipalName": "tswan@cloudaddc.qalab.cam.novell.com",  "distinguishedName": "CN=Timothy Swan,OU=Users,OU=Willow,DC=cloudaddc,DC=qalab,DC=cam,DC=novell,DC=com"}]}');*/
        $('#textarearight').val('{"Aidan Gillen": {"array": ["Game of Thrones","The Wire"],"string": "some string","int": "2","otherint": 4, "aboolean": "true", "boolean": false,"object": {"foo": "bar"}},"Amy Ryan": ["In Treatment","The Wire"],"Annie Fitzgerald": ["True Blood","Big Love","The Sopranos","Oz"],"Anwan Glover": ["Treme","The Wire"],"Alexander Skarsg?rd": ["Generation Kill","True Blood"],"Alice Farmer": ["The Corner","Oz","The Wire"]}');
    },

    getParameterByName: function (name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
            results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }
};
var hide_until_line_block =  function (line_number, codeBlock) {
    var lines = $('.' + codeBlock + '.codeBlock > div > div')
    for (let i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (parseInt(line.className.split(' ').pop().replace('line', '')) < line_number){
            line.style.display = 'none'
        }
        else {
            break
        }
    }
    var lines = $('.' + codeBlock + '.codeBlock > .gutter > span')
    for (let i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (parseInt(line.innerText.replace('.', '')) < line_number){
            line.style.display = 'none'
        }
        else {
            break
        }
    }
}

var hide_until_line = function (line_number_left, line_number_right) {
    hide_until_line_block(line_number_left, 'left')
    hide_until_line_block(line_number_right, 'right')
}

// Show images on fullscreen after click
function full_view_src(src){
    document.querySelector("#img-viewer").querySelector("img").setAttribute("src", src);
    document.querySelector("#img-viewer").style.display="block";
}

function full_view_pdf(srcLeft, srcRight){
    document.querySelector("#pdf-viewer").querySelector("#full-pdf-left").setAttribute("src", srcLeft);
    document.querySelector("#pdf-viewer").querySelector("#full-pdf-right").setAttribute("src", srcRight);
    document.querySelector("#pdf-viewer").style.display="block";
}

function close_full_screen_img(){
    document.querySelector("#img-viewer").style.display="none";
}

function close_full_screen_pdf(){
    document.querySelector("#pdf-viewer").style.display="none";
}

jQuery(document).ready(function () {
    $('#compare').click(function () {
        jdd.compare();
    });

    if (jdd.getParameterByName('left')) {
        $('#textarealeft').val(jdd.getParameterByName('left'));
    }

    if (jdd.getParameterByName('right')) {
        $('#textarearight').val(jdd.getParameterByName('right'));
    }

    if (jdd.getParameterByName('left') && jdd.getParameterByName('right')) {
        jdd.compare();
    }


    $('#sample').click(function (e) {
        e.preventDefault();
        jdd.loadSampleData();
    });

    $(document).keydown(function (event) {
        if (event.keyCode === 78 || event.keyCode === 39) {
            /*
             * The N key or right arrow key
             */
            jdd.highlightNextDiff();
        } else if (event.keyCode === 80 || event.keyCode === 37) {
            /*
             * The P key or left arrow key
             */
            jdd.highlightPrevDiff();
        }
    });
});

// polyfills

// Array.prototype.find
// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function (predicate) {
            // 1. Let O be ? ToObject(this value).
            if (this === null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            var thisArg = arguments[1];

            // 5. Let k be 0.
            var k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return kValue.
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return undefined.
            return undefined;
        },
        configurable: true,
        writable: true
    });
}

// Array.prototype.findIndex
// https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
        value: function (predicate) {
            // 1. Let O be ? ToObject(this value).
            if (this === null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            var thisArg = arguments[1];

            // 5. Let k be 0.
            var k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return k.
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return k;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return -1.
            return -1;
        },
        configurable: true,
        writable: true
    });
}
