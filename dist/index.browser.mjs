import unistVisit from 'unist-util-visit';
import isPlainObject from 'is-plain-obj';
import React from 'react';
import unified from 'unified';
import remarkRehype from 'remark-rehype';
import toEstree from 'hast-util-to-estree';
import visitParents from 'unist-util-visit-parents';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function visit(tree, type, visitor) {
    unistVisit(tree, type, visitor);
}

// from https://stackoverflow.com/a/53936623/1325646
const isValidHex = (hex) => /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
const getChunksFromString = (st, chunkSize) => st.match(new RegExp(`.{${chunkSize}}`, "g"));
const convertHexUnitTo256 = (hex) => parseInt(hex.repeat(2 / hex.length), 16);
function getAlphaFloat(a, alpha) {
    if (typeof a !== "undefined") {
        return a / 255;
    }
    if (typeof alpha != "number" || alpha < 0 || alpha > 1) {
        return 1;
    }
    return alpha;
}
function hexToObject(hex) {
    if (!hex) {
        return undefined;
    }
    if (!isValidHex(hex)) {
        throw new Error("Invalid color string, must be a valid hex color");
    }
    const chunkSize = Math.floor((hex.length - 1) / 3);
    const hexArr = getChunksFromString(hex.slice(1), chunkSize);
    const [r, g, b, a] = hexArr.map(convertHexUnitTo256);
    return {
        r,
        g,
        b,
        a: getAlphaFloat(a, 1),
    };
}
function objectToHex(object) {
    if (!object) {
        return undefined;
    }
    const { r, g, b, a } = object;
    const alpha = Math.round(a * 255);
    return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b
        .toString(16)
        .padStart(2, "0")}${alpha
        .toString(16)
        .padStart(2, "0")}`;
}
function transparent(color, opacity) {
    if (!color) {
        return color;
    }
    const { r, g, b, a } = hexToObject(color);
    return objectToHex({ r, g, b, a: a * opacity });
}

function splitParts(focus) {
    return focus.split(/,(?![^\[]*\])/g);
}
function mergeToObject(entries) {
    return entries.reduce((acc, obj) => Object.assign(acc, obj), {});
}
function parsePartToObject(part) {
    // a part could be
    // - a line number: "2"
    // - a line range: "5:9"
    // - a line number with a column selector: "2[1,3:5,9]"
    const columnsMatch = part.match(/(\d+)\[(.+)\]/);
    if (columnsMatch) {
        const [, line, columns] = columnsMatch;
        const columnsList = columns
            .split(",")
            .map(parseExtremes);
        const lineNumber = Number(line);
        return { [lineNumber]: columnsList };
    }
    else {
        return mergeToObject(expandString(part).map(lineNumber => ({
            [lineNumber]: true,
        })));
    }
}
function parseExtremes(part) {
    // Transforms something like
    // - "1:3" to {start:1, end: 3}
    // - "4" to {start:4, end:4}
    const [start, end] = part.split(":");
    if (!isNaturalNumber(start)) {
        throw new FocusNumberError(start);
    }
    const startNumber = Number(start);
    if (startNumber < 1) {
        throw new LineOrColumnNumberError();
    }
    if (!end) {
        return { start: startNumber, end: startNumber };
    }
    else {
        if (!isNaturalNumber(end)) {
            throw new FocusNumberError(end);
        }
        return { start: startNumber, end: +end };
    }
}
function expandString(part) {
    // Transforms something like
    // - "1:3" to [1,2,3]
    // - "4" to [4]
    const [start, end] = part.split(":");
    if (!isNaturalNumber(start)) {
        throw new FocusNumberError(start);
    }
    const startNumber = Number(start);
    if (startNumber < 1) {
        throw new LineOrColumnNumberError();
    }
    if (!end) {
        return [startNumber];
    }
    else {
        if (!isNaturalNumber(end)) {
            throw new FocusNumberError(end);
        }
        const list = [];
        for (let i = startNumber; i <= +end; i++) {
            list.push(i);
        }
        return list;
    }
}
function isNaturalNumber(n) {
    n = n.toString(); // force the value in case it is not
    var n1 = Math.abs(n), n2 = parseInt(n, 10);
    return !isNaN(n1) && n2 === n1 && n1.toString() === n;
}
class LineOrColumnNumberError extends Error {
    constructor() {
        super(`Invalid line or column number in focus string`);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
class FocusNumberError extends Error {
    constructor(number) {
        super(`Invalid number "${number}" in focus string`);
        this.number = number;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
// turns a relative string like (1,3) or [4:5] into a normal focus string
function relativeToAbsolute(relativeString, lineNumber) {
    if (!relativeString) {
        return lineNumber.toString();
    }
    if (relativeString.startsWith("[")) {
        return `${lineNumber}` + relativeString;
    }
    return splitParts(relativeString.slice(1, -1))
        .map(part => makePartAbsolute(part, lineNumber))
        .join(",");
}
function makePartAbsolute(part, lineNumber) {
    const focusMap = parsePartToObject(part);
    const keys = Object.keys(focusMap).map(k => +k);
    if (keys.length > 1) {
        const min = Math.min(...keys);
        const max = Math.max(...keys);
        return `${min + lineNumber - 1}:${max + lineNumber - 1}`;
    }
    const newMap = {};
    Object.keys(focusMap).forEach(ln => {
        newMap[+ln + lineNumber - 1] = focusMap[+ln];
    });
    return toFocusString(newMap);
}
function toFocusString(focusMap) {
    let parts = [];
    Object.keys(focusMap).forEach(ln => {
        const part = focusMap[+ln];
        if (part === true) {
            parts.push(ln);
        }
        else if (part instanceof Array) {
            const columnsString = part.map(extremes => extremes.start === extremes.end
                ? extremes.start
                : `${extremes.start}:${extremes.end}`);
            parts.push(`${ln}[${columnsString}]`);
        }
    });
    return parts.join(",");
}
function mergeFocus(fs1, fs2) {
    if (!fs1)
        return fs2 || "";
    if (!fs2)
        return fs1 || "";
    return `${fs1},${fs2}`;
}

var ColorName;
(function (ColorName) {
    ColorName[ColorName["CodeForeground"] = 0] = "CodeForeground";
    ColorName[ColorName["CodeBackground"] = 1] = "CodeBackground";
    ColorName[ColorName["EditorForeground"] = 2] = "EditorForeground";
    ColorName[ColorName["EditorBackground"] = 3] = "EditorBackground";
    ColorName[ColorName["FocusBorder"] = 4] = "FocusBorder";
    ColorName[ColorName["ActiveTabBackground"] = 5] = "ActiveTabBackground";
    ColorName[ColorName["ActiveTabForeground"] = 6] = "ActiveTabForeground";
    ColorName[ColorName["InactiveTabBackground"] = 7] = "InactiveTabBackground";
    ColorName[ColorName["InactiveTabForeground"] = 8] = "InactiveTabForeground";
    ColorName[ColorName["EditorGroupBorder"] = 9] = "EditorGroupBorder";
    ColorName[ColorName["EditorGroupHeaderBackground"] = 10] = "EditorGroupHeaderBackground";
    ColorName[ColorName["TabBorder"] = 11] = "TabBorder";
    ColorName[ColorName["ActiveTabBottomBorder"] = 12] = "ActiveTabBottomBorder";
    ColorName[ColorName["LineNumberForeground"] = 13] = "LineNumberForeground";
    ColorName[ColorName["InputForeground"] = 14] = "InputForeground";
    ColorName[ColorName["InputBackground"] = 15] = "InputBackground";
    ColorName[ColorName["InputBorder"] = 16] = "InputBorder";
    ColorName[ColorName["SelectionBackground"] = 17] = "SelectionBackground";
    ColorName[ColorName["IconForeground"] = 18] = "IconForeground";
    ColorName[ColorName["ListActiveSelectionBackground"] = 19] = "ListActiveSelectionBackground";
    ColorName[ColorName["ListActiveSelectionForeground"] = 20] = "ListActiveSelectionForeground";
    ColorName[ColorName["ListHoverBackground"] = 21] = "ListHoverBackground";
    ColorName[ColorName["ListHoverForeground"] = 22] = "ListHoverForeground";
    ColorName[ColorName["SideBarBackground"] = 23] = "SideBarBackground";
    ColorName[ColorName["SideBarForeground"] = 24] = "SideBarForeground";
    ColorName[ColorName["SideBarBorder"] = 25] = "SideBarBorder";
    // Background color for the highlight of line at the cursor position
    ColorName[ColorName["LineHighlightBackground"] = 26] = "LineHighlightBackground";
    // Background color of highlighted ranges, like by quick open and find features
    ColorName[ColorName["RangeHighlightBackground"] = 27] = "RangeHighlightBackground";
    // Foreground color of info squigglies in the editor
    ColorName[ColorName["EditorInfoForeground"] = 28] = "EditorInfoForeground";
})(ColorName || (ColorName = {}));
const contrastBorder = "#6FC3DF";
// defaults from: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/common/theme.ts
// and: https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/core/editorColorRegistry.ts
// and: https://github.com/microsoft/vscode/blob/main/src/vs/platform/theme/common/colorRegistry.ts
// keys from : https://code.visualstudio.com/api/references/theme-color#editor-groups-tabs
function getColor(theme, colorName) {
    var _a, _b;
    const colors = theme.colors || {};
    switch (colorName) {
        case ColorName.CodeForeground:
            return (((_a = getGlobalSettings(theme)) === null || _a === void 0 ? void 0 : _a.foreground) ||
                getColor(theme, ColorName.EditorForeground));
        case ColorName.CodeBackground:
            return (((_b = getGlobalSettings(theme)) === null || _b === void 0 ? void 0 : _b.background) ||
                getColor(theme, ColorName.EditorBackground));
        case ColorName.EditorBackground:
            return (colors["editor.background"] ||
                getDefault(theme, {
                    light: "#fffffe",
                    dark: "#1E1E1E",
                    hc: "#000000",
                }));
        case ColorName.EditorForeground:
            return (colors["editor.foreground"] ||
                getDefault(theme, {
                    light: "#333333",
                    dark: "#BBBBBB",
                    hc: "#fffffe",
                }));
        case ColorName.FocusBorder:
            return (colors["focusBorder"] ||
                getDefault(theme, {
                    light: "#0090F1",
                    dark: "#007FD4",
                    hc: contrastBorder,
                }));
        case ColorName.ActiveTabBackground:
            return (colors["tab.activeBackground"] ||
                getColor(theme, ColorName.EditorBackground));
        case ColorName.ActiveTabForeground:
            return (colors["tab.activeForeground"] ||
                getDefault(theme, {
                    dark: "#ffffff",
                    light: "#333333",
                    hc: "#ffffff",
                }));
        case ColorName.InactiveTabBackground:
            return (colors["tab.inactiveBackground"] ||
                getDefault(theme, {
                    dark: "#2D2D2D",
                    light: "#ECECEC",
                    hc: undefined,
                }));
        case ColorName.InactiveTabForeground:
            return (colors["tab.inactiveForeground"] ||
                getDefault(theme, {
                    dark: transparent(getColor(theme, ColorName.ActiveTabForeground), 0.5),
                    light: transparent(getColor(theme, ColorName.ActiveTabForeground), 0.7),
                    hc: "#ffffff",
                }));
        case ColorName.TabBorder:
            return (colors["tab.border"] ||
                getDefault(theme, {
                    dark: "#252526",
                    light: "#F3F3F3",
                    hc: contrastBorder,
                }));
        case ColorName.ActiveTabBottomBorder:
            return (colors["tab.activeBorder"] ||
                getColor(theme, ColorName.ActiveTabBackground));
        case ColorName.EditorGroupBorder:
            return (colors["editorGroup.border"] ||
                getDefault(theme, {
                    dark: "#444444",
                    light: "#E7E7E7",
                    hc: contrastBorder,
                }));
        case ColorName.EditorGroupHeaderBackground:
            return (colors["editorGroupHeader.tabsBackground"] ||
                getDefault(theme, {
                    dark: "#252526",
                    light: "#F3F3F3",
                    hc: undefined,
                }));
        case ColorName.LineNumberForeground:
            return (colors["editorLineNumber.foreground"] ||
                getDefault(theme, {
                    dark: "#858585",
                    light: "#237893",
                    hc: "#fffffe",
                }));
        case ColorName.InputBackground:
            return (colors["input.background"] ||
                getDefault(theme, {
                    dark: "#3C3C3C",
                    light: "#fffffe",
                    hc: "#000000",
                }));
        case ColorName.InputForeground:
            return (colors["input.foreground"] ||
                getColor(theme, ColorName.EditorForeground));
        case ColorName.InputBorder:
            return (colors["input.border"] ||
                getDefault(theme, {
                    dark: undefined,
                    light: undefined,
                    hc: contrastBorder,
                }));
        case ColorName.SelectionBackground:
            return (colors["editor.selectionBackground"] ||
                getDefault(theme, {
                    light: "#ADD6FF",
                    dark: "#264F78",
                    hc: "#f3f518",
                }));
        case ColorName.IconForeground:
            return (colors["icon.foreground"] ||
                getDefault(theme, {
                    dark: "#C5C5C5",
                    light: "#424242",
                    hc: "#FFFFFF",
                }));
        case ColorName.SideBarBackground:
            return (colors["sideBar.background"] ||
                getDefault(theme, {
                    dark: "#252526",
                    light: "#F3F3F3",
                    hc: "#000000",
                }));
        case ColorName.SideBarForeground:
            return (colors["sideBar.foreground"] ||
                getColor(theme, ColorName.EditorForeground));
        case ColorName.SideBarBorder:
            return (colors["sideBar.border"] ||
                getColor(theme, ColorName.SideBarBackground));
        case ColorName.ListActiveSelectionBackground:
            return (colors["list.activeSelectionBackground"] ||
                getDefault(theme, {
                    dark: "#094771",
                    light: "#0060C0",
                    hc: "#000000",
                }));
        case ColorName.ListActiveSelectionForeground:
            return (colors["list.activeSelectionForeground"] ||
                getDefault(theme, {
                    dark: "#fffffe",
                    light: "#fffffe",
                    hc: "#fffffe",
                }));
        case ColorName.ListHoverBackground:
            return (colors["list.hoverBackground"] ||
                getDefault(theme, {
                    dark: "#2A2D2E",
                    light: "#F0F0F0",
                    hc: undefined,
                }));
        case ColorName.ListHoverForeground:
            return colors["list.hoverForeground"] || undefined;
        case ColorName.LineHighlightBackground:
            return (colors["editor.lineHighlightBackground"] ||
                getDefault(theme, {
                    dark: undefined,
                    light: undefined,
                    hc: undefined,
                }));
        case ColorName.RangeHighlightBackground:
            return (colors["editor.rangeHighlightBackground"] ||
                getDefault(theme, {
                    dark: "#ffffff0b",
                    light: "#fdff0033",
                    hc: undefined,
                }));
        case ColorName.EditorInfoForeground:
            return (colors["editor.infoForeground"] ||
                getDefault(theme, {
                    dark: "#3794FF",
                    light: "#1a85ff",
                    hc: "#3794FF",
                }));
        default:
            return "#f00";
    }
}
function getDefault(theme, defaults) {
    return defaults[getThemeType(theme)];
}
function getThemeType(theme) {
    var _a;
    return (theme.type
        ? theme.type
        : ((_a = theme.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("light"))
            ? "light"
            : "dark");
}
function getGlobalSettings(theme) {
    let settings = theme.settings
        ? theme.settings
        : theme.tokenColors;
    const globalSetting = settings
        ? settings.find(s => {
            return !s.name && !s.scope;
        })
        : undefined;
    return globalSetting === null || globalSetting === void 0 ? void 0 : globalSetting.settings;
}

typeof window !== "undefined"
    ? React.useLayoutEffect
    : React.useEffect;

const annotationsMap = {
    box: Box,
    bg: MultilineMark,
    label: Label,
    link: CodeLink,
    mark: Mark,
    withClass: WithClass,
};
function Mark(props) {
    if (props.isInline) {
        return React.createElement(InlineMark, Object.assign({}, props));
    }
    else {
        return React.createElement(MultilineMark, Object.assign({}, props));
    }
}
function MultilineMark({ children, data, style, theme, }) {
    const className = `ch-code-multiline-mark ` + (data !== null && data !== void 0 ? data : "");
    const bg = getColor(theme, ColorName.RangeHighlightBackground);
    const border = getColor(theme, ColorName.EditorInfoForeground);
    return (React.createElement("div", { style: Object.assign(Object.assign({}, style), { background: bg }), className: className },
        React.createElement("span", { className: "ch-code-multiline-mark-border", style: { background: border } }),
        children));
}
function InlineMark({ children, data, theme, }) {
    const bg = tryGuessColor(children) ||
        transparent(getColor(theme, ColorName.CodeForeground), 0.2);
    const className = "ch-code-inline-mark " + (data !== null && data !== void 0 ? data : "");
    return (React.createElement("span", { className: className, style: { background: bg } }, children));
}
function tryGuessColor(children) {
    var _a, _b, _c;
    const child = React.Children.toArray(children)[0];
    const grandChild = React.Children.toArray(((_a = child === null || child === void 0 ? void 0 : child.props) === null || _a === void 0 ? void 0 : _a.children) || [])[0];
    const grandGrandChild = React.Children.toArray(((_b = grandChild === null || grandChild === void 0 ? void 0 : grandChild.props) === null || _b === void 0 ? void 0 : _b.children) || [])[0];
    const { color } = ((_c = grandGrandChild === null || grandGrandChild === void 0 ? void 0 : grandGrandChild.props) === null || _c === void 0 ? void 0 : _c.style) || {};
    if (color) {
        return transparent(color, 0.2);
    }
    return undefined;
}
function Box({ children, data, theme, }) {
    var _a, _b;
    const border = typeof data === "string"
        ? data
        : ((_b = (_a = theme.tokenColors.find((tc) => { var _a; return (_a = tc.scope) === null || _a === void 0 ? void 0 : _a.includes("string"); })) === null || _a === void 0 ? void 0 : _a.settings) === null || _b === void 0 ? void 0 : _b.foreground) || "yellow";
    return (React.createElement("span", { className: "ch-code-box-annotation", style: { outline: `2px solid ${border}` } }, children));
}
function WithClass({ children, data, style, theme, }) {
    const className = data;
    return (React.createElement("span", { style: style, className: className }, children));
}
function Label({ children, data, style, theme, }) {
    const bg = (theme.colors["editor.lineHighlightBackground"] ||
        theme.colors["editor.selectionHighlightBackground"]);
    const [hover, setHover] = React.useState(false);
    return (React.createElement("div", { style: Object.assign(Object.assign({}, style), { background: hover ? bg : undefined }), onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) },
        children,
        React.createElement("div", { style: {
                position: "absolute",
                right: 0,
                paddingRight: 16,
                display: hover ? "block" : "none",
                opacity: 0.7,
            } }, (data === null || data === void 0 ? void 0 : data.children) || data)));
}
function CodeLink({ children, isInline, style, data, }) {
    const url = (data === null || data === void 0 ? void 0 : data.url) || data;
    const title = data === null || data === void 0 ? void 0 : data.title;
    return (React.createElement("a", { href: url, title: title, className: isInline ? "ch-code-inline-link" : "ch-code-link", style: style }, children));
}

/**
 * Convert a value to an ESTree node
 *
 * @param value - The value to convert
 * @param options - Additional options to configure the output.
 * @returns The ESTree node.
 */
function valueToEstree(value, options = {}) {
    if (value === undefined) {
        return { type: "Identifier", name: "undefined" };
    }
    if (value == null) {
        return { type: "Literal", value: null, raw: "null" };
    }
    if (value === Number.POSITIVE_INFINITY) {
        return { type: "Identifier", name: "Infinity" };
    }
    if (Number.isNaN(value)) {
        return { type: "Identifier", name: "NaN" };
    }
    if (typeof value === "boolean") {
        return { type: "Literal", value, raw: String(value) };
    }
    if (typeof value === "bigint") {
        return value >= 0
            ? {
                type: "Literal",
                value,
                raw: `${value}n`,
                bigint: String(value),
            }
            : {
                type: "UnaryExpression",
                operator: "-",
                prefix: true,
                argument: valueToEstree(-value, options),
            };
    }
    if (typeof value === "number") {
        return value >= 0
            ? { type: "Literal", value, raw: String(value) }
            : {
                type: "UnaryExpression",
                operator: "-",
                prefix: true,
                argument: valueToEstree(-value, options),
            };
    }
    if (typeof value === "string") {
        return {
            type: "Literal",
            value,
            raw: JSON.stringify(value),
        };
    }
    if (typeof value === "symbol") {
        if (value.description &&
            value === Symbol.for(value.description)) {
            return {
                type: "CallExpression",
                optional: false,
                callee: {
                    type: "MemberExpression",
                    computed: false,
                    optional: false,
                    object: { type: "Identifier", name: "Symbol" },
                    property: { type: "Identifier", name: "for" },
                },
                arguments: [
                    valueToEstree(value.description, options),
                ],
            };
        }
        throw new TypeError(`Only global symbols are supported, got: ${String(value)}`);
    }
    if (Array.isArray(value)) {
        const elements = [];
        for (let i = 0; i < value.length; i += 1) {
            elements.push(i in value ? valueToEstree(value[i], options) : null);
        }
        return { type: "ArrayExpression", elements };
    }
    if (value instanceof RegExp) {
        return {
            type: "Literal",
            value,
            raw: String(value),
            regex: { pattern: value.source, flags: value.flags },
        };
    }
    if (value instanceof Date) {
        return {
            type: "NewExpression",
            callee: { type: "Identifier", name: "Date" },
            arguments: [valueToEstree(value.getTime(), options)],
        };
    }
    if (value instanceof Map) {
        return {
            type: "NewExpression",
            callee: { type: "Identifier", name: "Map" },
            arguments: [
                valueToEstree([...value.entries()], options),
            ],
        };
    }
    if (
    // https://github.com/code-hike/codehike/issues/194
    // value instanceof BigInt64Array ||
    // value instanceof BigUint64Array ||
    value instanceof Float32Array ||
        value instanceof Float64Array ||
        value instanceof Int8Array ||
        value instanceof Int16Array ||
        value instanceof Int32Array ||
        value instanceof Set ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Uint16Array ||
        value instanceof Uint32Array) {
        return {
            type: "NewExpression",
            callee: {
                type: "Identifier",
                name: value.constructor.name,
            },
            arguments: [valueToEstree([...value], options)],
        };
    }
    if (value instanceof URL ||
        value instanceof URLSearchParams) {
        return {
            type: "NewExpression",
            callee: {
                type: "Identifier",
                name: value.constructor.name,
            },
            arguments: [valueToEstree(String(value), options)],
        };
    }
    if (options.instanceAsObject || isPlainObject(value)) {
        if ((value === null || value === void 0 ? void 0 : value.name) === MDX_CHILDREN) {
            const tree = Object.assign({}, value);
            tree.name = null;
            return mdastToEstree(tree).body[0].expression;
        }
        if ((value === null || value === void 0 ? void 0 : value.type) ===
            "mdxJsxAttributeValueExpression") {
            return value.data.estree.body[0].expression;
        }
        return {
            type: "ObjectExpression",
            properties: Object.entries(value).map(([name, val]) => ({
                type: "Property",
                method: false,
                shorthand: false,
                computed: false,
                kind: "init",
                key: valueToEstree(name, options),
                value: valueToEstree(val, options),
            })),
        };
    }
    const isAnnotation = Object.values(annotationsMap).includes(value);
    // code hike annotations patch
    if (isAnnotation) {
        const identifier = Object.keys(annotationsMap).find(key => annotationsMap[key] === value);
        return {
            type: "MemberExpression",
            object: {
                type: "MemberExpression",
                object: {
                    type: "Identifier",
                    name: "CH",
                },
                property: {
                    type: "Identifier",
                    name: "annotations",
                },
                computed: false,
                optional: false,
            },
            property: {
                type: "Identifier",
                name: identifier,
            },
            computed: false,
            optional: false,
        };
    }
    throw new TypeError(`Unsupported value: ${String(value)}`);
}
function mdastToEstree(node) {
    const nodeTypes = [
        "mdxFlowExpression",
        "mdxJsxFlowElement",
        "mdxJsxTextElement",
        "mdxTextExpression",
        "mdxjsEsm",
    ];
    const changedTree = unified()
        .use(remarkRehype, {
        allowDangerousHtml: true,
        passThrough: nodeTypes,
    })
        .use(rehypeRecma)
        .runSync(node);
    return changedTree;
}
function rehypeRecma() {
    return (tree) => toEstree(tree);
}
const MDX_CHILDREN = "MDX_CHILDREN";
function wrapChildren(children) {
    const tree = {
        type: "mdxJsxFlowElement",
        children,
        name: MDX_CHILDREN,
    };
    return tree;
}

function splitChildren(parent, type) {
    const splits = [];
    let i = 0;
    parent.children.forEach((node, index) => {
        if (node.type === type) {
            i++;
        }
        else {
            if (!splits[i]) {
                splits[i] = [];
            }
            splits[i].push({ node, index, parent });
        }
    });
    return splits;
}
function visitAsync(tree, type, visitor) {
    return __awaiter(this, void 0, void 0, function* () {
        const promises = [];
        visit(tree, type, (node, index, parent) => {
            const result = visitor(node, index, parent);
            if (result) {
                promises.push(result);
            }
        });
        yield Promise.all(promises);
    });
}
const CH_CODE_CONFIG_VAR_NAME = "chCodeConfig";
/**
 * Transforms a node into a JSX Flow ELement (or another given type).
 * Most of the work is transforming the props object into an array
 * of mdxJsxAttribute.
 */
function toJSX(node, { type = "mdxJsxFlowElement", props, name, appendProps = false, addConfigProp = false, }) {
    node.type = type;
    if (name) {
        node.name = name;
    }
    if (!appendProps) {
        node.attributes = [];
    }
    else {
        node.attributes = node.attributes || [];
    }
    if (addConfigProp) {
        node.attributes.push(toAttribute("codeConfig", CH_CODE_CONFIG_VAR_NAME, {
            type: "Identifier",
            name: CH_CODE_CONFIG_VAR_NAME,
        }));
    }
    Object.keys(props).forEach(key => {
        if (props[key] === undefined) {
            return;
        }
        node.attributes.push(toAttribute(key, JSON.stringify(props[key]), valueToEstree(props[key])));
    });
}
function toAttribute(key, stringValue, expression) {
    return {
        type: "mdxJsxAttribute",
        name: key,
        value: {
            type: "mdxJsxAttributeValueExpression",
            value: stringValue,
            data: {
                estree: {
                    type: "Program",
                    body: [
                        {
                            type: "ExpressionStatement",
                            expression: expression,
                        },
                    ],
                    sourceType: "module",
                },
            },
        },
    };
}

const t=[{id:"abap",scopeName:"source.abap",path:"abap.tmLanguage.json",samplePath:"abap.sample"},{id:"actionscript-3",scopeName:"source.actionscript.3",path:"actionscript-3.tmLanguage.json",samplePath:"actionscript-3.sample"},{id:"ada",scopeName:"source.ada",path:"ada.tmLanguage.json",samplePath:"ada.sample"},{id:"apache",scopeName:"source.apacheconf",path:"apache.tmLanguage.json"},{id:"apex",scopeName:"source.apex",path:"apex.tmLanguage.json",samplePath:"apex.sample"},{id:"apl",scopeName:"source.apl",path:"apl.tmLanguage.json",embeddedLangs:["html","xml","css","javascript","json"]},{id:"applescript",scopeName:"source.applescript",path:"applescript.tmLanguage.json",samplePath:"applescript.sample"},{id:"asm",scopeName:"source.asm.x86_64",path:"asm.tmLanguage.json",samplePath:"asm.sample"},{id:"astro",scopeName:"text.html.astro",path:"astro.tmLanguage.json",samplePath:"astro.sample",embeddedLangs:["css","javascript","less","sass","scss","stylus","typescript","tsx"]},{id:"awk",scopeName:"source.awk",path:"awk.tmLanguage.json",samplePath:"awk.sample"},{id:"ballerina",scopeName:"source.ballerina",path:"ballerina.tmLanguage.json",samplePath:"ballerina.sample"},{id:"bat",scopeName:"source.batchfile",path:"bat.tmLanguage.json",samplePath:"bat.sample",aliases:["batch"]},{id:"berry",scopeName:"source.berry",path:"berry.tmLanguage.json",samplePath:"berry.sample",aliases:["be"]},{id:"bibtex",scopeName:"text.bibtex",path:"bibtex.tmLanguage.json"},{id:"bicep",scopeName:"source.bicep",path:"bicep.tmLanguage.json",samplePath:"bicep.sample"},{id:"c",scopeName:"source.c",path:"c.tmLanguage.json",samplePath:"c.sample"},{id:"clojure",scopeName:"source.clojure",path:"clojure.tmLanguage.json",samplePath:"clojure.sample",aliases:["clj"]},{id:"cobol",scopeName:"source.cobol",path:"cobol.tmLanguage.json",samplePath:"cobol.sample",embeddedLangs:["sql","html","java"]},{id:"codeql",scopeName:"source.ql",path:"codeql.tmLanguage.json",samplePath:"codeql.sample",aliases:["ql"]},{id:"coffee",scopeName:"source.coffee",path:"coffee.tmLanguage.json",samplePath:"coffee.sample",embeddedLangs:["javascript"]},{id:"cpp",scopeName:"source.cpp",path:"cpp.tmLanguage.json",samplePath:"cpp.sample",embeddedLangs:["sql"]},{id:"crystal",scopeName:"source.crystal",path:"crystal.tmLanguage.json",samplePath:"crystal.sample",embeddedLangs:["html","sql","css","c","javascript","shellscript"]},{id:"csharp",scopeName:"source.cs",path:"csharp.tmLanguage.json",samplePath:"csharp.sample",aliases:["c#"]},{id:"css",scopeName:"source.css",path:"css.tmLanguage.json",samplePath:"css.sample"},{id:"cue",scopeName:"source.cue",path:"cue.tmLanguage.json",samplePath:"cue.sample"},{id:"d",scopeName:"source.d",path:"d.tmLanguage.json",samplePath:"d.sample"},{id:"dart",scopeName:"source.dart",path:"dart.tmLanguage.json",samplePath:"dart.sample"},{id:"diff",scopeName:"source.diff",path:"diff.tmLanguage.json",samplePath:"diff.sample"},{id:"docker",scopeName:"source.dockerfile",path:"docker.tmLanguage.json",samplePath:"docker.sample"},{id:"dream-maker",scopeName:"source.dm",path:"dream-maker.tmLanguage.json"},{id:"elixir",scopeName:"source.elixir",path:"elixir.tmLanguage.json",samplePath:"elixir.sample",embeddedLangs:["html"]},{id:"elm",scopeName:"source.elm",path:"elm.tmLanguage.json",samplePath:"elm.sample"},{id:"erb",scopeName:"text.html.erb",path:"erb.tmLanguage.json",samplePath:"erb.sample",embeddedLangs:["html","ruby"]},{id:"erlang",scopeName:"source.erlang",path:"erlang.tmLanguage.json",samplePath:"erlang.sample"},{id:"fish",scopeName:"source.fish",path:"fish.tmLanguage.json",samplePath:"fish.sample"},{id:"fsharp",scopeName:"source.fsharp",path:"fsharp.tmLanguage.json",samplePath:"fsharp.sample",aliases:["f#"],embeddedLangs:["markdown"]},{id:"gherkin",scopeName:"text.gherkin.feature",path:"gherkin.tmLanguage.json"},{id:"git-commit",scopeName:"text.git-commit",path:"git-commit.tmLanguage.json",embeddedLangs:["diff"]},{id:"git-rebase",scopeName:"text.git-rebase",path:"git-rebase.tmLanguage.json",embeddedLangs:["shellscript"]},{id:"gnuplot",scopeName:"source.gnuplot",path:"gnuplot.tmLanguage.json"},{id:"go",scopeName:"source.go",path:"go.tmLanguage.json",samplePath:"go.sample"},{id:"graphql",scopeName:"source.graphql",path:"graphql.tmLanguage.json",embeddedLangs:["javascript","typescript","jsx","tsx"]},{id:"groovy",scopeName:"source.groovy",path:"groovy.tmLanguage.json"},{id:"hack",scopeName:"source.hack",path:"hack.tmLanguage.json",embeddedLangs:["html","sql"]},{id:"haml",scopeName:"text.haml",path:"haml.tmLanguage.json",embeddedLangs:["ruby","javascript","sass","coffee","markdown","css"]},{id:"handlebars",scopeName:"text.html.handlebars",path:"handlebars.tmLanguage.json",aliases:["hbs"],embeddedLangs:["html","css","javascript","yaml"]},{id:"haskell",scopeName:"source.haskell",path:"haskell.tmLanguage.json"},{id:"hcl",scopeName:"source.hcl",path:"hcl.tmLanguage.json"},{id:"hlsl",scopeName:"source.hlsl",path:"hlsl.tmLanguage.json"},{id:"html",scopeName:"text.html.basic",path:"html.tmLanguage.json",samplePath:"html.sample",embeddedLangs:["javascript","css"]},{id:"ini",scopeName:"source.ini",path:"ini.tmLanguage.json"},{id:"java",scopeName:"source.java",path:"java.tmLanguage.json",samplePath:"java.sample"},{id:"javascript",scopeName:"source.js",path:"javascript.tmLanguage.json",samplePath:"javascript.sample",aliases:["js"]},{id:"jinja-html",scopeName:"text.html.jinja",path:"jinja-html.tmLanguage.json",embeddedLangs:["html"]},{id:"json",scopeName:"source.json",path:"json.tmLanguage.json"},{id:"jsonc",scopeName:"source.json.comments",path:"jsonc.tmLanguage.json"},{id:"jsonnet",scopeName:"source.jsonnet",path:"jsonnet.tmLanguage.json"},{id:"jssm",scopeName:"source.jssm",path:"jssm.tmLanguage.json",samplePath:"jssm.sample",aliases:["fsl"]},{id:"jsx",scopeName:"source.js.jsx",path:"jsx.tmLanguage.json"},{id:"julia",scopeName:"source.julia",path:"julia.tmLanguage.json",embeddedLangs:["cpp","python","javascript","r","sql"]},{id:"jupyter",scopeName:"source.jupyter",path:"jupyter.tmLanguage.json",embeddedLangs:["json"]},{id:"kotlin",scopeName:"source.kotlin",path:"kotlin.tmLanguage.json"},{id:"latex",scopeName:"text.tex.latex",path:"latex.tmLanguage.json",embeddedLangs:["tex","css","html","java","javascript","typescript","lua","python","julia","ruby","xml","yaml","cpp","haskell","scala","gnuplot"]},{id:"less",scopeName:"source.css.less",path:"less.tmLanguage.json",embeddedLangs:["css"]},{id:"lisp",scopeName:"source.lisp",path:"lisp.tmLanguage.json"},{id:"logo",scopeName:"source.logo",path:"logo.tmLanguage.json"},{id:"lua",scopeName:"source.lua",path:"lua.tmLanguage.json",embeddedLangs:["c"]},{id:"make",scopeName:"source.makefile",path:"make.tmLanguage.json",aliases:["makefile"]},{id:"markdown",scopeName:"text.html.markdown",path:"markdown.tmLanguage.json",aliases:["md"],embeddedLangs:["css","html","ini","java","lua","make","perl","r","ruby","php","sql","vb","xml","xsl","yaml","bat","clojure","coffee","c","cpp","diff","docker","git-commit","git-rebase","go","groovy","pug","javascript","json","jsonc","less","objective-c","swift","scss","raku","powershell","python","rust","scala","shellscript","typescript","tsx","csharp","fsharp","dart","handlebars","erlang","elixir","latex","bibtex"]},{id:"marko",scopeName:"text.marko",path:"marko.tmLanguage.json",samplePath:"marko.sample",embeddedLangs:["css","less","scss","javascript"]},{id:"matlab",scopeName:"source.matlab",path:"matlab.tmLanguage.json"},{id:"mdx",scopeName:"text.html.markdown.jsx",path:"mdx.tmLanguage.json",embeddedLangs:["jsx","markdown"]},{id:"nginx",scopeName:"source.nginx",path:"nginx.tmLanguage.json",embeddedLangs:["lua"]},{id:"nim",scopeName:"source.nim",path:"nim.tmLanguage.json",embeddedLangs:["c","html","xml","javascript","css","markdown"]},{id:"nix",scopeName:"source.nix",path:"nix.tmLanguage.json"},{id:"objective-c",scopeName:"source.objc",path:"objective-c.tmLanguage.json",aliases:["objc"]},{id:"objective-cpp",scopeName:"source.objcpp",path:"objective-cpp.tmLanguage.json"},{id:"ocaml",scopeName:"source.ocaml",path:"ocaml.tmLanguage.json"},{id:"pascal",scopeName:"source.pascal",path:"pascal.tmLanguage.json"},{id:"perl",scopeName:"source.perl",path:"perl.tmLanguage.json",embeddedLangs:["html","xml","css","javascript","sql"]},{id:"php",scopeName:"source.php",path:"php.tmLanguage.json",embeddedLangs:["html","xml","sql","javascript","json","css"]},{id:"plsql",scopeName:"source.plsql.oracle",path:"plsql.tmLanguage.json"},{id:"postcss",scopeName:"source.css.postcss",path:"postcss.tmLanguage.json"},{id:"powershell",scopeName:"source.powershell",path:"powershell.tmLanguage.json",aliases:["ps","ps1"]},{id:"prisma",scopeName:"source.prisma",path:"prisma.tmLanguage.json",samplePath:"prisma.sample"},{id:"prolog",scopeName:"source.prolog",path:"prolog.tmLanguage.json"},{id:"pug",scopeName:"text.pug",path:"pug.tmLanguage.json",aliases:["jade"],embeddedLangs:["javascript","css","sass","stylus","coffee","html"]},{id:"puppet",scopeName:"source.puppet",path:"puppet.tmLanguage.json"},{id:"purescript",scopeName:"source.purescript",path:"purescript.tmLanguage.json"},{id:"python",scopeName:"source.python",path:"python.tmLanguage.json",samplePath:"python.sample",aliases:["py"]},{id:"r",scopeName:"source.r",path:"r.tmLanguage.json"},{id:"raku",scopeName:"source.perl.6",path:"raku.tmLanguage.json",aliases:["perl6"]},{id:"razor",scopeName:"text.aspnetcorerazor",path:"razor.tmLanguage.json",embeddedLangs:["html","csharp"]},{id:"rel",scopeName:"source.rel",path:"rel.tmLanguage.json",samplePath:"rel.sample"},{id:"riscv",scopeName:"source.riscv",path:"riscv.tmLanguage.json"},{id:"ruby",scopeName:"source.ruby",path:"ruby.tmLanguage.json",samplePath:"ruby.sample",aliases:["rb"],embeddedLangs:["html","xml","sql","css","c","javascript","shellscript","lua"]},{id:"rust",scopeName:"source.rust",path:"rust.tmLanguage.json",aliases:["rs"]},{id:"sas",scopeName:"source.sas",path:"sas.tmLanguage.json",embeddedLangs:["sql"]},{id:"sass",scopeName:"source.sass",path:"sass.tmLanguage.json"},{id:"scala",scopeName:"source.scala",path:"scala.tmLanguage.json"},{id:"scheme",scopeName:"source.scheme",path:"scheme.tmLanguage.json"},{id:"scss",scopeName:"source.css.scss",path:"scss.tmLanguage.json",embeddedLangs:["css"]},{id:"shaderlab",scopeName:"source.shaderlab",path:"shaderlab.tmLanguage.json",aliases:["shader"],embeddedLangs:["hlsl"]},{id:"shellscript",scopeName:"source.shell",path:"shellscript.tmLanguage.json",aliases:["shell","bash","sh","zsh"],embeddedLangs:["ruby","python","applescript","html","markdown"]},{id:"smalltalk",scopeName:"source.smalltalk",path:"smalltalk.tmLanguage.json"},{id:"solidity",scopeName:"source.solidity",path:"solidity.tmLanguage.json"},{id:"sparql",scopeName:"source.sparql",path:"sparql.tmLanguage.json",samplePath:"sparql.sample",embeddedLangs:["turtle"]},{id:"sql",scopeName:"source.sql",path:"sql.tmLanguage.json"},{id:"ssh-config",scopeName:"source.ssh-config",path:"ssh-config.tmLanguage.json"},{id:"stata",scopeName:"source.stata",path:"stata.tmLanguage.json",samplePath:"stata.sample",embeddedLangs:["sql"]},{id:"stylus",scopeName:"source.stylus",path:"stylus.tmLanguage.json",aliases:["styl"]},{id:"svelte",scopeName:"source.svelte",path:"svelte.tmLanguage.json",embeddedLangs:["javascript","typescript","coffee","stylus","sass","css","scss","less","postcss","pug","markdown"]},{id:"swift",scopeName:"source.swift",path:"swift.tmLanguage.json"},{id:"system-verilog",scopeName:"source.systemverilog",path:"system-verilog.tmLanguage.json"},{id:"tasl",scopeName:"source.tasl",path:"tasl.tmLanguage.json",samplePath:"tasl.sample"},{id:"tcl",scopeName:"source.tcl",path:"tcl.tmLanguage.json"},{id:"tex",scopeName:"text.tex",path:"tex.tmLanguage.json",embeddedLangs:["r"]},{id:"toml",scopeName:"source.toml",path:"toml.tmLanguage.json"},{id:"tsx",scopeName:"source.tsx",path:"tsx.tmLanguage.json",samplePath:"tsx.sample"},{id:"turtle",scopeName:"source.turtle",path:"turtle.tmLanguage.json",samplePath:"turtle.sample"},{id:"twig",scopeName:"text.html.twig",path:"twig.tmLanguage.json",embeddedLangs:["css","javascript","php","python","ruby"]},{id:"typescript",scopeName:"source.ts",path:"typescript.tmLanguage.json",aliases:["ts"]},{id:"vb",scopeName:"source.asp.vb.net",path:"vb.tmLanguage.json",aliases:["cmd"]},{id:"verilog",scopeName:"source.verilog",path:"verilog.tmLanguage.json"},{id:"vhdl",scopeName:"source.vhdl",path:"vhdl.tmLanguage.json"},{id:"viml",scopeName:"source.viml",path:"viml.tmLanguage.json",aliases:["vim","vimscript"]},{id:"vue-html",scopeName:"text.html.vue-html",path:"vue-html.tmLanguage.json",embeddedLangs:["vue","javascript"]},{id:"vue",scopeName:"source.vue",path:"vue.tmLanguage.json",embeddedLangs:["json","markdown","pug","haml","vue-html","sass","scss","less","stylus","postcss","css","typescript","coffee","javascript"]},{id:"wasm",scopeName:"source.wat",path:"wasm.tmLanguage.json"},{id:"wenyan",scopeName:"source.wenyan",path:"wenyan.tmLanguage.json",aliases:["文言"]},{id:"xml",scopeName:"text.xml",path:"xml.tmLanguage.json",embeddedLangs:["java"]},{id:"xsl",scopeName:"text.xml.xsl",path:"xsl.tmLanguage.json",embeddedLangs:["xml"]},{id:"yaml",scopeName:"source.yaml",path:"yaml.tmLanguage.json"},{id:"zenscript",scopeName:"source.zenscript",path:"zenscript.tmLanguage.json",samplePath:"zenscript.sample"}];var n;!function(e){e[e.NotSet=-1]="NotSet",e[e.None=0]="None",e[e.Italic=1]="Italic",e[e.Bold=2]="Bold",e[e.Underline=4]="Underline";}(n||(n={}));class r{static toBinaryStr(e){let t=e.toString(2);for(;t.length<32;)t="0"+t;return t}static printMetadata(e){let t=r.getLanguageId(e),n=r.getTokenType(e),a=r.getFontStyle(e),s=r.getForeground(e),o=r.getBackground(e);console.log({languageId:t,tokenType:n,fontStyle:a,foreground:s,background:o});}static getLanguageId(e){return (255&e)>>>0}static getTokenType(e){return (1792&e)>>>8}static getFontStyle(e){return (14336&e)>>>11}static getForeground(e){return (8372224&e)>>>14}static getBackground(e){return (4286578688&e)>>>23}static set(e,t,a,s,o,i){let c=r.getLanguageId(e),u=r.getTokenType(e),l=r.getFontStyle(e),p=r.getForeground(e),h=r.getBackground(e);return 0!==t&&(c=t),0!==a&&(u=8===a?0:a),s!==n.NotSet&&(l=s),0!==o&&(p=o),0!==i&&(h=i),(c<<0|u<<8|l<<11|p<<14|h<<23)>>>0}}function a(e){return e.endsWith("/")||e.endsWith("\\")?e.slice(0,-1):e}function s(e){return e.startsWith("./")?e.slice(2):e}var o,i,c,u={exports:{}};function l(e,t){void 0===t&&(t=!1);var n=e.length,r=0,a="",s=0,o=16,i=0,c=0,u=0,l=0,f=0;function g(t,n){for(var a=0,s=0;a<t||!n;){var o=e.charCodeAt(r);if(o>=48&&o<=57)s=16*s+o-48;else if(o>=65&&o<=70)s=16*s+o-65+10;else {if(!(o>=97&&o<=102))break;s=16*s+o-97+10;}r++,a++;}return a<t&&(s=-1),s}function m(){if(a="",f=0,s=r,c=i,l=u,r>=n)return s=n,o=17;var t=e.charCodeAt(r);if(p(t)){do{r++,a+=String.fromCharCode(t),t=e.charCodeAt(r);}while(p(t));return o=15}if(h(t))return r++,a+=String.fromCharCode(t),13===t&&10===e.charCodeAt(r)&&(r++,a+="\n"),i++,u=r,o=14;switch(t){case 123:return r++,o=1;case 125:return r++,o=2;case 91:return r++,o=3;case 93:return r++,o=4;case 58:return r++,o=6;case 44:return r++,o=5;case 34:return r++,a=function(){for(var t="",a=r;;){if(r>=n){t+=e.substring(a,r),f=2;break}var s=e.charCodeAt(r);if(34===s){t+=e.substring(a,r),r++;break}if(92!==s){if(s>=0&&s<=31){if(h(s)){t+=e.substring(a,r),f=2;break}f=6;}r++;}else {if(t+=e.substring(a,r),++r>=n){f=2;break}switch(e.charCodeAt(r++)){case 34:t+='"';break;case 92:t+="\\";break;case 47:t+="/";break;case 98:t+="\b";break;case 102:t+="\f";break;case 110:t+="\n";break;case 114:t+="\r";break;case 116:t+="\t";break;case 117:var o=g(4,!0);o>=0?t+=String.fromCharCode(o):f=4;break;default:f=5;}a=r;}}return t}(),o=10;case 47:var m=r-1;if(47===e.charCodeAt(r+1)){for(r+=2;r<n&&!h(e.charCodeAt(r));)r++;return a=e.substring(m,r),o=12}if(42===e.charCodeAt(r+1)){r+=2;for(var y=n-1,v=!1;r<y;){var b=e.charCodeAt(r);if(42===b&&47===e.charCodeAt(r+1)){r+=2,v=!0;break}r++,h(b)&&(13===b&&10===e.charCodeAt(r)&&r++,i++,u=r);}return v||(r++,f=1),a=e.substring(m,r),o=13}return a+=String.fromCharCode(t),r++,o=16;case 45:if(a+=String.fromCharCode(t),++r===n||!d(e.charCodeAt(r)))return o=16;case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:return a+=function(){var t=r;if(48===e.charCodeAt(r))r++;else for(r++;r<e.length&&d(e.charCodeAt(r));)r++;if(r<e.length&&46===e.charCodeAt(r)){if(!(++r<e.length&&d(e.charCodeAt(r))))return f=3,e.substring(t,r);for(r++;r<e.length&&d(e.charCodeAt(r));)r++;}var n=r;if(r<e.length&&(69===e.charCodeAt(r)||101===e.charCodeAt(r)))if((++r<e.length&&43===e.charCodeAt(r)||45===e.charCodeAt(r))&&r++,r<e.length&&d(e.charCodeAt(r))){for(r++;r<e.length&&d(e.charCodeAt(r));)r++;n=r;}else f=3;return e.substring(t,n)}(),o=11;default:for(;r<n&&_(t);)r++,t=e.charCodeAt(r);if(s!==r){switch(a=e.substring(s,r)){case"true":return o=8;case"false":return o=9;case"null":return o=7}return o=16}return a+=String.fromCharCode(t),r++,o=16}}function _(e){if(p(e)||h(e))return !1;switch(e){case 125:case 93:case 123:case 91:case 34:case 58:case 44:case 47:return !1}return !0}return {setPosition:function(e){r=e,a="",s=0,o=16,f=0;},getPosition:function(){return r},scan:t?function(){var e;do{e=m();}while(e>=12&&e<=15);return e}:m,getToken:function(){return o},getTokenValue:function(){return a},getTokenOffset:function(){return s},getTokenLength:function(){return r-s},getTokenStartLine:function(){return c},getTokenStartCharacter:function(){return s-l},getTokenError:function(){return f}}}function p(e){return 32===e||9===e||11===e||12===e||160===e||5760===e||e>=8192&&e<=8203||8239===e||8287===e||12288===e||65279===e}function h(e){return 10===e||13===e||8232===e||8233===e}function d(e){return e>=48&&e<=57}u.exports=(o={770:function(e,t,n){var r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.setDefaultDebugCall=t.createOnigScanner=t.createOnigString=t.loadWASM=t.OnigScanner=t.OnigString=void 0;const a=r(n(418));let s=null,o=!1;class i{constructor(e){const t=e.length,n=i._utf8ByteLength(e),r=n!==t,a=r?new Uint32Array(t+1):null;r&&(a[t]=n);const s=r?new Uint32Array(n+1):null;r&&(s[n]=t);const o=new Uint8Array(n);let c=0;for(let n=0;n<t;n++){const i=e.charCodeAt(n);let u=i,l=!1;if(i>=55296&&i<=56319&&n+1<t){const t=e.charCodeAt(n+1);t>=56320&&t<=57343&&(u=65536+(i-55296<<10)|t-56320,l=!0);}r&&(a[n]=c,l&&(a[n+1]=c),u<=127?s[c+0]=n:u<=2047?(s[c+0]=n,s[c+1]=n):u<=65535?(s[c+0]=n,s[c+1]=n,s[c+2]=n):(s[c+0]=n,s[c+1]=n,s[c+2]=n,s[c+3]=n)),u<=127?o[c++]=u:u<=2047?(o[c++]=192|(1984&u)>>>6,o[c++]=128|(63&u)>>>0):u<=65535?(o[c++]=224|(61440&u)>>>12,o[c++]=128|(4032&u)>>>6,o[c++]=128|(63&u)>>>0):(o[c++]=240|(1835008&u)>>>18,o[c++]=128|(258048&u)>>>12,o[c++]=128|(4032&u)>>>6,o[c++]=128|(63&u)>>>0),l&&n++;}this.utf16Length=t,this.utf8Length=n,this.utf16Value=e,this.utf8Value=o,this.utf16OffsetToUtf8=a,this.utf8OffsetToUtf16=s;}static _utf8ByteLength(e){let t=0;for(let n=0,r=e.length;n<r;n++){const a=e.charCodeAt(n);let s=a,o=!1;if(a>=55296&&a<=56319&&n+1<r){const t=e.charCodeAt(n+1);t>=56320&&t<=57343&&(s=65536+(a-55296<<10)|t-56320,o=!0);}t+=s<=127?1:s<=2047?2:s<=65535?3:4,o&&n++;}return t}createString(e){const t=e._omalloc(this.utf8Length);return e.HEAPU8.set(this.utf8Value,t),t}}class c{constructor(e){if(this.id=++c.LAST_ID,!s)throw new Error("Must invoke loadWASM first.");this._onigBinding=s,this.content=e;const t=new i(e);this.utf16Length=t.utf16Length,this.utf8Length=t.utf8Length,this.utf16OffsetToUtf8=t.utf16OffsetToUtf8,this.utf8OffsetToUtf16=t.utf8OffsetToUtf16,this.utf8Length<1e4&&!c._sharedPtrInUse?(c._sharedPtr||(c._sharedPtr=s._omalloc(1e4)),c._sharedPtrInUse=!0,s.HEAPU8.set(t.utf8Value,c._sharedPtr),this.ptr=c._sharedPtr):this.ptr=t.createString(s);}convertUtf8OffsetToUtf16(e){return this.utf8OffsetToUtf16?e<0?0:e>this.utf8Length?this.utf16Length:this.utf8OffsetToUtf16[e]:e}convertUtf16OffsetToUtf8(e){return this.utf16OffsetToUtf8?e<0?0:e>this.utf16Length?this.utf8Length:this.utf16OffsetToUtf8[e]:e}dispose(){this.ptr===c._sharedPtr?c._sharedPtrInUse=!1:this._onigBinding._ofree(this.ptr);}}t.OnigString=c,c.LAST_ID=0,c._sharedPtr=0,c._sharedPtrInUse=!1;class u{constructor(e){if(!s)throw new Error("Must invoke loadWASM first.");const t=[],n=[];for(let r=0,a=e.length;r<a;r++){const a=new i(e[r]);t[r]=a.createString(s),n[r]=a.utf8Length;}const r=s._omalloc(4*e.length);s.HEAPU32.set(t,r/4);const a=s._omalloc(4*e.length);s.HEAPU32.set(n,a/4);const o=s._createOnigScanner(r,a,e.length);for(let n=0,r=e.length;n<r;n++)s._ofree(t[n]);s._ofree(a),s._ofree(r),0===o&&function(e){throw new Error(e.UTF8ToString(e._getLastOnigError()))}(s),this._onigBinding=s,this._ptr=o;}dispose(){this._onigBinding._freeOnigScanner(this._ptr);}findNextMatchSync(e,t,n){let r=o,a=0;if("number"==typeof n?(8&n&&(r=!0),a=n):"boolean"==typeof n&&(r=n),"string"==typeof e){e=new c(e);const n=this._findNextMatchSync(e,t,r,a);return e.dispose(),n}return this._findNextMatchSync(e,t,r,a)}_findNextMatchSync(e,t,n,r){const a=this._onigBinding;let s;if(s=n?a._findNextOnigScannerMatchDbg(this._ptr,e.id,e.ptr,e.utf8Length,e.convertUtf16OffsetToUtf8(t),r):a._findNextOnigScannerMatch(this._ptr,e.id,e.ptr,e.utf8Length,e.convertUtf16OffsetToUtf8(t),r),0===s)return null;const o=a.HEAPU32;let i=s/4;const c=o[i++],u=o[i++];let l=[];for(let t=0;t<u;t++){const n=e.convertUtf8OffsetToUtf16(o[i++]),r=e.convertUtf8OffsetToUtf16(o[i++]);l[t]={start:n,end:r,length:r-n};}return {index:c,captureIndices:l}}}t.OnigScanner=u;let l=!1,p=null;t.loadWASM=function(e){if(l)return p;let t,n,r,o;if(l=!0,function(e){return "function"==typeof e.instantiator}(e))t=e.instantiator,n=e.print;else {let r;e instanceof ArrayBuffer||e instanceof Response?r=e:(r=e.data,n=e.print),t=r instanceof ArrayBuffer?function(e){return t=>WebAssembly.instantiate(e,t)}(r):r instanceof Response&&"function"==typeof WebAssembly.instantiateStreaming?function(e){return t=>WebAssembly.instantiateStreaming(e,t)}(r):function(e){return async t=>{const n=await e.arrayBuffer();return WebAssembly.instantiate(n,t)}}(r);}return p=new Promise(((e,t)=>{r=e,o=t;})),function(e,t,n,r){a.default({print:t,instantiateWasm:(t,n)=>{if("undefined"==typeof performance){const e=()=>Date.now();t.env.emscripten_get_now=e,t.wasi_snapshot_preview1.emscripten_get_now=e;}return e(t).then((e=>n(e.instance)),r),{}}}).then((e=>{s=e,n();}));}(t,n,r,o),p},t.createOnigString=function(e){return new c(e)},t.createOnigScanner=function(e){return new u(e)},t.setDefaultDebugCall=function(e){o=e;};},418:e=>{var t=("undefined"!=typeof document&&document.currentScript&&document.currentScript.src,function(e){var t,n,r=void 0!==(e=e||{})?e:{};r.ready=new Promise((function(e,r){t=e,n=r;}));var a,s={};for(a in r)r.hasOwnProperty(a)&&(s[a]=r[a]);var o,i=!1,c="";function u(e){return r.locateFile?r.locateFile(e,c):c+e}o=function(e){var t;return "function"==typeof readbuffer?new Uint8Array(readbuffer(e)):(g("object"==typeof(t=read(e,"binary"))),t)},"undefined"!=typeof scriptArgs&&scriptArgs,"undefined"!=typeof onig_print&&("undefined"==typeof console&&(console={}),console.log=onig_print,console.warn=console.error="undefined"!=typeof printErr?printErr:onig_print);var l,p,h=r.print||console.log.bind(console),d=r.printErr||console.warn.bind(console);for(a in s)s.hasOwnProperty(a)&&(r[a]=s[a]);s=null,r.arguments&&r.arguments,r.thisProgram&&r.thisProgram,r.quit&&r.quit,r.wasmBinary&&(l=r.wasmBinary),r.noExitRuntime,"object"!=typeof WebAssembly&&F("no native wasm support detected");var f=!1;function g(e,t){e||F("Assertion failed: "+t);}var m,_,y,v="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0;function b(e,t,n){for(var r=t+n,a=t;e[a]&&!(a>=r);)++a;if(a-t>16&&e.subarray&&v)return v.decode(e.subarray(t,a));for(var s="";t<a;){var o=e[t++];if(128&o){var i=63&e[t++];if(192!=(224&o)){var c=63&e[t++];if((o=224==(240&o)?(15&o)<<12|i<<6|c:(7&o)<<18|i<<12|c<<6|63&e[t++])<65536)s+=String.fromCharCode(o);else {var u=o-65536;s+=String.fromCharCode(55296|u>>10,56320|1023&u);}}else s+=String.fromCharCode((31&o)<<6|i);}else s+=String.fromCharCode(o);}return s}function k(e,t){return e?b(_,e,t):""}function L(e,t){return e%t>0&&(e+=t-e%t),e}function w(e){m=e,r.HEAP8=new Int8Array(e),r.HEAP16=new Int16Array(e),r.HEAP32=y=new Int32Array(e),r.HEAPU8=_=new Uint8Array(e),r.HEAPU16=new Uint16Array(e),r.HEAPU32=new Uint32Array(e),r.HEAPF32=new Float32Array(e),r.HEAPF64=new Float64Array(e);}"undefined"!=typeof TextDecoder&&new TextDecoder("utf-16le"),r.INITIAL_MEMORY;var j,C=[],S=[],N=[],x=[];function P(){if(r.preRun)for("function"==typeof r.preRun&&(r.preRun=[r.preRun]);r.preRun.length;)I(r.preRun.shift());K(C);}function T(){K(S);}function A(){K(N);}function R(){if(r.postRun)for("function"==typeof r.postRun&&(r.postRun=[r.postRun]);r.postRun.length;)O(r.postRun.shift());K(x);}function I(e){C.unshift(e);}function O(e){x.unshift(e);}S.push({func:function(){ae();}});var E=0,M=null;function D(e){E++,r.monitorRunDependencies&&r.monitorRunDependencies(E);}function G(e){if(E--,r.monitorRunDependencies&&r.monitorRunDependencies(E),0==E&&M){var t=M;M=null,t();}}function F(e){r.onAbort&&r.onAbort(e),d(e+=""),f=!0,e="abort("+e+"). Build with -s ASSERTIONS=1 for more info.";var t=new WebAssembly.RuntimeError(e);throw n(t),t}function B(e,t){return String.prototype.startsWith?e.startsWith(t):0===e.indexOf(t)}r.preloadedImages={},r.preloadedAudios={};var U="data:application/octet-stream;base64,";function W(e){return B(e,U)}var $,q="onig.wasm";function z(e){try{if(e==q&&l)return new Uint8Array(l);if(o)return o(e);throw "both async and sync fetching of the wasm failed"}catch(e){F(e);}}function H(){return l||!i||"function"!=typeof fetch?Promise.resolve().then((function(){return z(q)})):fetch(q,{credentials:"same-origin"}).then((function(e){if(!e.ok)throw "failed to load wasm binary file at '"+q+"'";return e.arrayBuffer()})).catch((function(){return z(q)}))}function V(){var e={env:re,wasi_snapshot_preview1:re};function t(e,t){var n=e.exports;r.asm=n,w((p=r.asm.memory).buffer),j=r.asm.__indirect_function_table,G();}function a(e){t(e.instance);}function s(t){return H().then((function(t){return WebAssembly.instantiate(t,e)})).then(t,(function(e){d("failed to asynchronously prepare wasm: "+e),F(e);}))}if(D(),r.instantiateWasm)try{return r.instantiateWasm(e,t)}catch(e){return d("Module.instantiateWasm callback failed with error: "+e),!1}return (l||"function"!=typeof WebAssembly.instantiateStreaming||W(q)||"function"!=typeof fetch?s(a):fetch(q,{credentials:"same-origin"}).then((function(t){return WebAssembly.instantiateStreaming(t,e).then(a,(function(e){return d("wasm streaming compile failed: "+e),d("falling back to ArrayBuffer instantiation"),s(a)}))}))).catch(n),{}}function K(e){for(;e.length>0;){var t=e.shift();if("function"!=typeof t){var n=t.func;"number"==typeof n?void 0===t.arg?j.get(n)():j.get(n)(t.arg):n(void 0===t.arg?null:t.arg);}else t(r);}}function X(e,t,n){_.copyWithin(e,t,t+n);}function Y(){return _.length}function J(e){try{return p.grow(e-m.byteLength+65535>>>16),w(p.buffer),1}catch(e){}}function Q(e){var t=Y(),n=2147483648;if(e>n)return !1;for(var r=1;r<=4;r*=2){var a=t*(1+.2/r);if(a=Math.min(a,e+100663296),J(Math.min(n,L(Math.max(e,a),65536))))return !0}return !1}W(q)||(q=u(q)),$="undefined"!=typeof dateNow?dateNow:function(){return performance.now()};var Z={mappings:{},buffers:[null,[],[]],printChar:function(e,t){var n=Z.buffers[e];0===t||10===t?((1===e?h:d)(b(n,0)),n.length=0):n.push(t);},varargs:void 0,get:function(){return Z.varargs+=4,y[Z.varargs-4>>2]},getStr:function(e){return k(e)},get64:function(e,t){return e}};function ee(e,t,n,r){for(var a=0,s=0;s<n;s++){for(var o=y[t+8*s>>2],i=y[t+(8*s+4)>>2],c=0;c<i;c++)Z.printChar(e,_[o+c]);a+=i;}return y[r>>2]=a,0}function te(e){}var ne,re={emscripten_get_now:$,emscripten_memcpy_big:X,emscripten_resize_heap:Q,fd_write:ee,setTempRet0:te},ae=(V(),r.___wasm_call_ctors=function(){return (ae=r.___wasm_call_ctors=r.asm.__wasm_call_ctors).apply(null,arguments)});function se(e){function n(){ne||(ne=!0,r.calledRun=!0,f||(T(),A(),t(r),r.onRuntimeInitialized&&r.onRuntimeInitialized(),R()));}E>0||(P(),E>0||(r.setStatus?(r.setStatus("Running..."),setTimeout((function(){setTimeout((function(){r.setStatus("");}),1),n();}),1)):n()));}if(r.___errno_location=function(){return (r.___errno_location=r.asm.__errno_location).apply(null,arguments)},r._omalloc=function(){return (r._omalloc=r.asm.omalloc).apply(null,arguments)},r._ofree=function(){return (r._ofree=r.asm.ofree).apply(null,arguments)},r._getLastOnigError=function(){return (r._getLastOnigError=r.asm.getLastOnigError).apply(null,arguments)},r._createOnigScanner=function(){return (r._createOnigScanner=r.asm.createOnigScanner).apply(null,arguments)},r._freeOnigScanner=function(){return (r._freeOnigScanner=r.asm.freeOnigScanner).apply(null,arguments)},r._findNextOnigScannerMatch=function(){return (r._findNextOnigScannerMatch=r.asm.findNextOnigScannerMatch).apply(null,arguments)},r._findNextOnigScannerMatchDbg=function(){return (r._findNextOnigScannerMatchDbg=r.asm.findNextOnigScannerMatchDbg).apply(null,arguments)},r.stackSave=function(){return (r.stackSave=r.asm.stackSave).apply(null,arguments)},r.stackRestore=function(){return (r.stackRestore=r.asm.stackRestore).apply(null,arguments)},r.stackAlloc=function(){return (r.stackAlloc=r.asm.stackAlloc).apply(null,arguments)},r.dynCall_jiji=function(){return (r.dynCall_jiji=r.asm.dynCall_jiji).apply(null,arguments)},r.UTF8ToString=k,M=function e(){ne||se(),ne||(M=e);},r.run=se,r.preInit)for("function"==typeof r.preInit&&(r.preInit=[r.preInit]);r.preInit.length>0;)r.preInit.pop()();return se(),e.ready});e.exports=t;}},i={},function e(t){var n=i[t];if(void 0!==n)return n.exports;var r=i[t]={exports:{}};return o[t].call(r.exports,r,r.exports,e),r.exports}(770)),function(e){e.DEFAULT={allowTrailingComma:!1};}(c||(c={}));var f=function(e,t,n){void 0===t&&(t=[]),void 0===n&&(n=c.DEFAULT);var r=null,a=[],s=[];function o(e){Array.isArray(a)?a.push(e):null!==r&&(a[r]=e);}return function(e,t,n){void 0===n&&(n=c.DEFAULT);var r=l(e,!1);function a(e){return e?function(){return e(r.getTokenOffset(),r.getTokenLength(),r.getTokenStartLine(),r.getTokenStartCharacter())}:function(){return !0}}function s(e){return e?function(t){return e(t,r.getTokenOffset(),r.getTokenLength(),r.getTokenStartLine(),r.getTokenStartCharacter())}:function(){return !0}}var o=a(t.onObjectBegin),i=s(t.onObjectProperty),u=a(t.onObjectEnd),p=a(t.onArrayBegin),h=a(t.onArrayEnd),d=s(t.onLiteralValue),f=s(t.onSeparator),g=a(t.onComment),m=s(t.onError),_=n&&n.disallowComments,y=n&&n.allowTrailingComma;function v(){for(;;){var e=r.scan();switch(r.getTokenError()){case 4:b(14);break;case 5:b(15);break;case 3:b(13);break;case 1:_||b(11);break;case 2:b(12);break;case 6:b(16);}switch(e){case 12:case 13:_?b(10):g();break;case 16:b(1);break;case 15:case 14:break;default:return e}}}function b(e,t,n){if(void 0===t&&(t=[]),void 0===n&&(n=[]),m(e),t.length+n.length>0)for(var a=r.getToken();17!==a;){if(-1!==t.indexOf(a)){v();break}if(-1!==n.indexOf(a))break;a=v();}}function k(e){var t=r.getTokenValue();return e?d(t):i(t),v(),!0}function L(){switch(r.getToken()){case 11:var e=r.getTokenValue(),t=Number(e);isNaN(t)&&(b(2),t=0),d(t);break;case 7:d(null);break;case 8:d(!0);break;case 9:d(!1);break;default:return !1}return v(),!0}function w(){return 10!==r.getToken()?(b(3,[],[2,5]),!1):(k(!1),6===r.getToken()?(f(":"),v(),S()||b(4,[],[2,5])):b(5,[],[2,5]),!0)}function j(){o(),v();for(var e=!1;2!==r.getToken()&&17!==r.getToken();){if(5===r.getToken()){if(e||b(4,[],[]),f(","),v(),2===r.getToken()&&y)break}else e&&b(6,[],[]);w()||b(4,[],[2,5]),e=!0;}return u(),2!==r.getToken()?b(7,[2],[]):v(),!0}function C(){p(),v();for(var e=!1;4!==r.getToken()&&17!==r.getToken();){if(5===r.getToken()){if(e||b(4,[],[]),f(","),v(),4===r.getToken()&&y)break}else e&&b(6,[],[]);S()||b(4,[],[4,5]),e=!0;}return h(),4!==r.getToken()?b(8,[4],[]):v(),!0}function S(){switch(r.getToken()){case 3:return C();case 1:return j();case 10:return k(!0);default:return L()}}if(v(),17===r.getToken())return !!n.allowEmptyContent||(b(4,[],[]),!1);if(!S())return b(4,[],[]),!1;17!==r.getToken()&&b(9,[],[]);}(e,{onObjectBegin:function(){var e={};o(e),s.push(a),a=e,r=null;},onObjectProperty:function(e){r=e;},onObjectEnd:function(){a=s.pop();},onArrayBegin:function(){var e=[];o(e),s.push(a),a=e,r=null;},onArrayEnd:function(){a=s.pop();},onLiteralValue:o,onError:function(e,n,r){t.push({error:e,offset:n,length:r});}},n),a[0]};const g="undefined"!=typeof self&&void 0!==self.WorkerGlobalScope||"undefined"!=typeof window&&void 0!==window.document&&"undefined"!=typeof fetch;let m="";function y(e){m=e;}let b=null;function k(e){if(g)return m||console.warn("[Shiki] no CDN provider found, use `setCDN()` to specify the CDN for loading the resources before calling `getHighlighter()`"),`${m}${e}`;{const t=require("path");return t.isAbsolute(e)?e:t.resolve(__dirname,"..",e)}}async function L(e){const t=[],n=f(await async function(e){const t=k(e);if(g)return await fetch(t).then((e=>e.text()));{const e=require("fs");return await e.promises.readFile(t,"utf-8")}}(e),t,{allowTrailingComma:!0});if(t.length)throw t[0];return n}async function w(e){const t=j(await L(e));if(t.include){const n=await w(function(...e){return e.map(a).map(s).join("/")}(function(e){const t=e.split(/[\/\\]/g);return t[t.length-2]}(e),t.include));n.settings&&(t.settings=n.settings.concat(t.settings)),n.bg&&!t.bg&&(t.bg=n.bg),n.colors&&(t.colors=Object.assign(Object.assign({},n.colors),t.colors)),delete t.include;}return t}function j(e){const t=e.type||"dark",n=Object.assign(Object.assign({name:e.name,type:t},e),function(e){var t,n,r,a,s,o;let i,c,u=e.settings?e.settings:e.tokenColors;const l=u?u.find((e=>!e.name&&!e.scope)):void 0;(null===(t=null==l?void 0:l.settings)||void 0===t?void 0:t.foreground)&&(i=l.settings.foreground);(null===(n=null==l?void 0:l.settings)||void 0===n?void 0:n.background)&&(c=l.settings.background);!i&&(null===(a=null===(r=e)||void 0===r?void 0:r.colors)||void 0===a?void 0:a["editor.foreground"])&&(i=e.colors["editor.foreground"]);!c&&(null===(o=null===(s=e)||void 0===s?void 0:s.colors)||void 0===o?void 0:o["editor.background"])&&(c=e.colors["editor.background"]);i||(i="light"===e.type?C:S);c||(c="light"===e.type?N:x);return {fg:i,bg:c}}(e));var r;return e.include&&(n.include=e.include),e.tokenColors&&(n.settings=e.tokenColors,delete n.tokenColors),(r=n).settings||(r.settings=[]),r.settings[0]&&r.settings[0].settings&&!r.settings[0].scope||r.settings.unshift({settings:{foreground:r.fg,background:r.bg}}),n}const C="#333333",S="#bbbbbb",N="#fffffe",x="#1e1e1e";class P{constructor(e,t){this.languagesPath="languages/",this.languageMap={},this.scopeToLangMap={},this._onigLibPromise=e,this._onigLibName=t;}get onigLib(){return this._onigLibPromise}getOnigLibName(){return this._onigLibName}getLangRegistration(e){return this.languageMap[e]}async loadGrammar(e){const n=this.scopeToLangMap[e];if(!n)return null;if(n.grammar)return n.grammar;const r=await async function(e){return await L(e)}(t.includes(n)?`${this.languagesPath}${n.path}`:n.path);return n.grammar=r,r}addLanguage(e){this.languageMap[e.id]=e,e.aliases&&e.aliases.forEach((t=>{this.languageMap[t]=e;})),this.scopeToLangMap[e.scopeName]=e;}}var T={exports:{}};function A(e,t){let n=[];for(let r=0,a=t.length;r<a;r++){let a=t.slice(0,r),s=t[r];n[r]={scopeName:s,themeMatches:O(e,s,a)};}return n}function R(e,t){let n=e+".";return e===t||t.substring(0,n.length)===n}function I(e,t,n,r){if(!R(e,n))return !1;let a=t.length-1,s=r.length-1;for(;a>=0&&s>=0;)R(t[a],r[s])&&a--,s--;return -1===a}function O(e,t,n){let r=[],a=0;for(let s=0,o=e.settings.length;s<o;s++){let o,i=e.settings[s];if("string"==typeof i.scope)o=i.scope.split(/,/).map((e=>e.trim()));else {if(!Array.isArray(i.scope))continue;o=i.scope;}for(let e=0,s=o.length;e<s;e++){let c=o[e].split(/ /);I(c[c.length-1],c.slice(0,c.length-1),t,n)&&(r[a++]=i,e=s);}}return r}function E(e,t={}){var r;const a=t.bg||"#fff",s=function(e,t){const n=new Map;for(const r of e){const e=t(r);n.has(e)?n.get(e).push(r):n.set(e,[r]);}return n}(null!==(r=t.lineOptions)&&void 0!==r?r:[],(e=>e.line));let o="";return o+=`<pre class="shiki" style="background-color: ${a}">`,t.langId&&(o+=`<div class="language-id">${t.langId}</div>`),o+="<code>",e.forEach(((e,r)=>{var a;const i=r+1,c=function(e){var t;const n=new Set(["line"]);for(const r of e)for(const e of null!==(t=r.classes)&&void 0!==t?t:[])n.add(e);return Array.from(n)}(null!==(a=s.get(i))&&void 0!==a?a:[]).join(" ");o+=`<span class="${c}">`,e.forEach((e=>{const r=[`color: ${e.color||t.fg}`];e.fontStyle&n.Italic&&r.push("font-style: italic"),e.fontStyle&n.Bold&&r.push("font-weight: bold"),e.fontStyle&n.Underline&&r.push("text-decoration: underline"),o+=`<span style="${r.join("; ")}">${function(e){return e.replace(/[&<>"']/g,(e=>M[e]))}(e.content)}</span>`;})),o+="</span>\n";})),o=o.replace(/\n*$/,""),o+="</code></pre>",o}T.exports=function(e){var t={};function n(r){if(t[r])return t[r].exports;var a=t[r]={i:r,l:!1,exports:{}};return e[r].call(a.exports,a,a.exports,n),a.l=!0,a.exports}return n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r});},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0});},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var a in e)n.d(r,a,function(t){return e[t]}.bind(null,a));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=3)}([function(e,t,n){Object.defineProperty(t,"__esModule",{value:!0});var r=n(1),a=n(5),s=n(6),o=n(2),i="undefined"==typeof performance?function(){return Date.now()}:function(){return performance.now()};t.createGrammar=function(e,t,n,r,a,s){return new v(e,t,n,r,a,s)};var c=function(e){this.scopeName=e;};t.FullScopeDependency=c;var u=function(){function e(e,t){this.scopeName=e,this.include=t;}return e.prototype.toKey=function(){return this.scopeName+"#"+this.include},e}();t.PartialScopeDependency=u;var l=function(){function e(){this.full=[],this.partial=[],this.visitedRule=new Set,this._seenFull=new Set,this._seenPartial=new Set;}return e.prototype.add=function(e){e instanceof c?this._seenFull.has(e.scopeName)||(this._seenFull.add(e.scopeName),this.full.push(e)):this._seenPartial.has(e.toKey())||(this._seenPartial.add(e.toKey()),this.partial.push(e));},e}();function p(e,t,n,a,s){for(var o=0,i=a;o<i.length;o++){var l=i[o];if(!e.visitedRule.has(l)){e.visitedRule.add(l);var f=l.repository?r.mergeObjects({},s,l.repository):s;Array.isArray(l.patterns)&&p(e,t,n,l.patterns,f);var g=l.include;if(g)if("$base"===g||g===t.scopeName)d(e,t,t);else if("$self"===g||g===n.scopeName)d(e,t,n);else if("#"===g.charAt(0))h(e,t,n,g.substring(1),f);else {var m=g.indexOf("#");if(m>=0){var _=g.substring(0,m),y=g.substring(m+1);_===t.scopeName?h(e,t,t,y,f):_===n.scopeName?h(e,t,n,y,f):e.add(new u(_,g.substring(m+1)));}else e.add(new c(g));}}}}function h(e,t,n,r,a){void 0===a&&(a=n.repository),a&&a[r]&&p(e,t,n,[a[r]],a);}function d(e,t,n){if(n.patterns&&Array.isArray(n.patterns)&&p(e,t,n,n.patterns,n.repository),n.injections){var r=[];for(var a in n.injections)r.push(n.injections[a]);p(e,t,n,r,n.repository);}}function f(e,t){if(!e)return !1;if(e===t)return !0;var n=t.length;return e.length>n&&e.substr(0,n)===t&&"."===e[n]}function g(e,t){if(t.length<e.length)return !1;var n=0;return e.every((function(e){for(var r=n;r<t.length;r++)if(f(t[r],e))return n=r+1,!0;return !1}))}function m(e,t,n,r,o){for(var i=s.createMatchers(t,g),c=a.RuleFactory.getCompiledRuleId(n,r,o.repository),u=0,l=i;u<l.length;u++){var p=l[u];e.push({matcher:p.matcher,ruleId:c,grammar:o,priority:p.priority});}}t.ScopeDependencyCollector=l,t.collectSpecificDependencies=h,t.collectDependencies=d;var _=function(e,t,n,r){this.scopeName=e,this.languageId=t,this.tokenType=n,this.themeData=r;};t.ScopeMetadata=_;var y=function(){function e(t,n,r){if(this._initialLanguage=t,this._themeProvider=n,this._cache=new Map,this._defaultMetaData=new _("",this._initialLanguage,0,[this._themeProvider.getDefaults()]),this._embeddedLanguages=Object.create(null),r)for(var a=Object.keys(r),s=0,o=a.length;s<o;s++){var i=a[s],c=r[i];"number"==typeof c&&0!==c?this._embeddedLanguages[i]=c:console.warn("Invalid embedded language found at scope "+i+": <<"+c+">>");}var u=Object.keys(this._embeddedLanguages).map((function(t){return e._escapeRegExpCharacters(t)}));0===u.length?this._embeddedLanguagesRegex=null:(u.sort(),u.reverse(),this._embeddedLanguagesRegex=new RegExp("^(("+u.join(")|(")+"))($|\\.)",""));}return e.prototype.onDidChangeTheme=function(){this._cache=new Map,this._defaultMetaData=new _("",this._initialLanguage,0,[this._themeProvider.getDefaults()]);},e.prototype.getDefaultMetadata=function(){return this._defaultMetaData},e._escapeRegExpCharacters=function(e){return e.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g,"\\$&")},e.prototype.getMetadataForScope=function(t){if(null===t)return e._NULL_SCOPE_METADATA;var n=this._cache.get(t);return n||(n=this._doGetMetadataForScope(t),this._cache.set(t,n),n)},e.prototype._doGetMetadataForScope=function(e){var t=this._scopeToLanguage(e),n=this._toStandardTokenType(e),r=this._themeProvider.themeMatch(e);return new _(e,t,n,r)},e.prototype._scopeToLanguage=function(e){if(!e)return 0;if(!this._embeddedLanguagesRegex)return 0;var t=e.match(this._embeddedLanguagesRegex);return t&&(this._embeddedLanguages[t[1]]||0)||0},e.prototype._toStandardTokenType=function(t){var n=t.match(e.STANDARD_TOKEN_TYPE_REGEXP);if(!n)return 0;switch(n[1]){case"comment":return 1;case"string":return 2;case"regex":return 4;case"meta.embedded":return 8}throw new Error("Unexpected match for standard token type!")},e._NULL_SCOPE_METADATA=new _("",0,0,null),e.STANDARD_TOKEN_TYPE_REGEXP=/\b(comment|string|regex|meta\.embedded)\b/,e}(),v=function(){function e(e,t,n,r,a,o){if(this._scopeMetadataProvider=new y(t,a,n),this._onigLib=o,this._rootId=-1,this._lastRuleId=0,this._ruleId2desc=[null],this._includedGrammars={},this._grammarRepository=a,this._grammar=k(e,null),this._injections=null,this._tokenTypeMatchers=[],r)for(var i=0,c=Object.keys(r);i<c.length;i++)for(var u=c[i],l=0,p=s.createMatchers(u,g);l<p.length;l++){var h=p[l];this._tokenTypeMatchers.push({matcher:h.matcher,type:r[u]});}}return e.prototype.dispose=function(){for(var e=0,t=this._ruleId2desc;e<t.length;e++){var n=t[e];n&&n.dispose();}},e.prototype.createOnigScanner=function(e){return this._onigLib.createOnigScanner(e)},e.prototype.createOnigString=function(e){return this._onigLib.createOnigString(e)},e.prototype.onDidChangeTheme=function(){this._scopeMetadataProvider.onDidChangeTheme();},e.prototype.getMetadataForScope=function(e){return this._scopeMetadataProvider.getMetadataForScope(e)},e.prototype.getInjections=function(){var e=this;if(null===this._injections){this._injections=[];var t=this._grammar.injections;if(t)for(var n in t)m(this._injections,n,t[n],this,this._grammar);if(this._grammarRepository){var r=this._grammarRepository.injections(this._grammar.scopeName);r&&r.forEach((function(t){var n=e.getExternalGrammar(t);if(n){var r=n.injectionSelector;r&&m(e._injections,r,n,e,n);}}));}this._injections.sort((function(e,t){return e.priority-t.priority}));}return this._injections},e.prototype.registerRule=function(e){var t=++this._lastRuleId,n=e(t);return this._ruleId2desc[t]=n,n},e.prototype.getRule=function(e){return this._ruleId2desc[e]},e.prototype.getExternalGrammar=function(e,t){if(this._includedGrammars[e])return this._includedGrammars[e];if(this._grammarRepository){var n=this._grammarRepository.lookup(e);if(n)return this._includedGrammars[e]=k(n,t&&t.$base),this._includedGrammars[e]}return null},e.prototype.tokenizeLine=function(e,t){var n=this._tokenize(e,t,!1);return {tokens:n.lineTokens.getResult(n.ruleStack,n.lineLength),ruleStack:n.ruleStack}},e.prototype.tokenizeLine2=function(e,t){var n=this._tokenize(e,t,!0);return {tokens:n.lineTokens.getBinaryResult(n.ruleStack,n.lineLength),ruleStack:n.ruleStack}},e.prototype._tokenize=function(e,t,n){var r;if(-1===this._rootId&&(this._rootId=a.RuleFactory.getCompiledRuleId(this._grammar.repository.$self,this,this._grammar.repository)),t&&t!==x.NULL)r=!1,t.reset();else {r=!0;var s=this._scopeMetadataProvider.getDefaultMetadata(),o=s.themeData[0],i=S.set(0,s.languageId,s.tokenType,o.fontStyle,o.foreground,o.background),c=this.getRule(this._rootId).getName(null,null),u=this._scopeMetadataProvider.getMetadataForScope(c),l=N.mergeMetadata(i,null,u),p=new N(null,null===c?"unknown":c,l);t=new x(null,this._rootId,-1,-1,!1,null,p,p);}e+="\n";var h=this.createOnigString(e),d=h.content.length,f=new T(n,e,this._tokenTypeMatchers),g=C(this,h,r,0,t,f,!0);return b(h),{lineLength:d,lineTokens:f,ruleStack:g}},e}();function b(e){"function"==typeof e.dispose&&e.dispose();}function k(e,t){return (e=r.clone(e)).repository=e.repository||{},e.repository.$self={$vscodeTextmateLocation:e.$vscodeTextmateLocation,patterns:e.patterns,name:e.scopeName},e.repository.$base=t||e.repository.$self,e}function L(e,t,n,r,a,s,o){if(0!==s.length){for(var i=t.content,c=Math.min(s.length,o.length),u=[],l=o[0].end,p=0;p<c;p++){var h=s[p];if(null!==h){var d=o[p];if(0!==d.length){if(d.start>l)break;for(;u.length>0&&u[u.length-1].endPos<=d.start;)a.produceFromScopes(u[u.length-1].scopes,u[u.length-1].endPos),u.pop();if(u.length>0?a.produceFromScopes(u[u.length-1].scopes,d.start):a.produce(r,d.start),h.retokenizeCapturedWithRuleId){var f=h.getName(i,o),g=r.contentNameScopesList.push(e,f),m=h.getContentName(i,o),_=g.push(e,m),y=r.push(h.retokenizeCapturedWithRuleId,d.start,-1,!1,null,g,_),v=e.createOnigString(i.substring(0,d.end));C(e,v,n&&0===d.start,d.start,y,a,!1),b(v);}else {var k=h.getName(i,o);if(null!==k){var L=(u.length>0?u[u.length-1].scopes:r.contentNameScopesList).push(e,k);u.push(new P(L,d.end));}}}}}for(;u.length>0;)a.produceFromScopes(u[u.length-1].scopes,u[u.length-1].endPos),u.pop();}}function w(e){for(var t=[],n=0,r=e.rules.length;n<r;n++)t.push("   - "+e.rules[n]+": "+e.debugRegExps[n]);return t.join("\n")}function j(e,t,n,r,a,s){var c=function(e,t,n,r,a,s){var c=a.getRule(e),u=c.compile(e,a.endRule,n,r===s),l=0;o.DebugFlags.InDebugMode&&(l=i());var p=u.scanner.findNextMatchSync(t,r);if(o.DebugFlags.InDebugMode){var h=i()-l;h>5&&console.warn("Rule "+c.debugName+" ("+c.id+") matching took "+h+" against '"+t+"'"),p&&console.log("matched rule id: "+u.rules[p.index]+" from "+p.captureIndices[0].start+" to "+p.captureIndices[0].end);}return p?{captureIndices:p.captureIndices,matchedRuleId:u.rules[p.index]}:null}(e,t,n,r,a,s),u=e.getInjections();if(0===u.length)return c;var l=function(e,t,n,r,a,s,i){for(var c,u=Number.MAX_VALUE,l=null,p=0,h=s.contentNameScopesList.generateScopes(),d=0,f=e.length;d<f;d++){var g=e[d];if(g.matcher(h)){var m=t.getRule(g.ruleId).compile(t,null,r,a===i),_=m.scanner.findNextMatchSync(n,a);if(o.DebugFlags.InDebugMode&&(console.log("  scanning for injections"),console.log(w(m))),_){var y=_.captureIndices[0].start;if(!(y>=u)&&(u=y,l=_.captureIndices,c=m.rules[_.index],p=g.priority,u===a))break}}}return l?{priorityMatch:-1===p,captureIndices:l,matchedRuleId:c}:null}(u,e,t,n,r,a,s);if(!l)return c;if(!c)return l;var p=c.captureIndices[0].start,h=l.captureIndices[0].start;return h<p||l.priorityMatch&&h===p?l:c}function C(e,t,n,r,s,i,c){var u=t.content.length,l=!1,p=-1;if(c){var h=function(e,t,n,r,s,i){for(var c=s.beginRuleCapturedEOL?0:-1,u=[],l=s;l;l=l.pop()){var p=l.getRule(e);p instanceof a.BeginWhileRule&&u.push({rule:p,stack:l});}for(var h=u.pop();h;h=u.pop()){var d=h.rule.compileWhile(e,h.stack.endRule,n,c===r),f=d.scanner.findNextMatchSync(t,r);if(o.DebugFlags.InDebugMode&&(console.log("  scanning for while rule"),console.log(w(d))),!f){o.DebugFlags.InDebugMode&&console.log("  popping "+h.rule.debugName+" - "+h.rule.debugWhileRegExp),s=h.stack.pop();break}if(-2!==d.rules[f.index]){s=h.stack.pop();break}f.captureIndices&&f.captureIndices.length&&(i.produce(h.stack,f.captureIndices[0].start),L(e,t,n,h.stack,i,h.rule.whileCaptures,f.captureIndices),i.produce(h.stack,f.captureIndices[0].end),c=f.captureIndices[0].end,f.captureIndices[0].end>r&&(r=f.captureIndices[0].end,n=!1));}return {stack:s,linePos:r,anchorPosition:c,isFirstLine:n}}(e,t,n,r,s,i);s=h.stack,r=h.linePos,n=h.isFirstLine,p=h.anchorPosition;}for(;!l;)d();function d(){o.DebugFlags.InDebugMode&&(console.log(""),console.log("@@scanNext "+r+": |"+t.content.substr(r).replace(/\n$/,"\\n")+"|"));var c=j(e,t,n,r,s,p);if(!c)return o.DebugFlags.InDebugMode&&console.log("  no more matches."),i.produce(s,u),void(l=!0);var h=c.captureIndices,d=c.matchedRuleId,f=!!(h&&h.length>0)&&h[0].end>r;if(-1===d){var g=s.getRule(e);o.DebugFlags.InDebugMode&&console.log("  popping "+g.debugName+" - "+g.debugEndRegExp),i.produce(s,h[0].start),s=s.setContentNameScopesList(s.nameScopesList),L(e,t,n,s,i,g.endCaptures,h),i.produce(s,h[0].end);var m=s;if(s=s.pop(),p=m.getAnchorPos(),!f&&m.getEnterPos()===r)return o.DebugFlags.InDebugMode&&console.error("[1] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing"),s=m,i.produce(s,u),void(l=!0)}else {var _=e.getRule(d);i.produce(s,h[0].start);var y=s,v=_.getName(t.content,h),b=s.contentNameScopesList.push(e,v);if(s=s.push(d,r,p,h[0].end===u,null,b,b),_ instanceof a.BeginEndRule){var k=_;o.DebugFlags.InDebugMode&&console.log("  pushing "+k.debugName+" - "+k.debugBeginRegExp),L(e,t,n,s,i,k.beginCaptures,h),i.produce(s,h[0].end),p=h[0].end;var w=k.getContentName(t.content,h),C=b.push(e,w);if(s=s.setContentNameScopesList(C),k.endHasBackReferences&&(s=s.setEndRule(k.getEndWithResolvedBackReferences(t.content,h))),!f&&y.hasSameRuleAs(s))return o.DebugFlags.InDebugMode&&console.error("[2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"),s=s.pop(),i.produce(s,u),void(l=!0)}else if(_ instanceof a.BeginWhileRule){if(k=_,o.DebugFlags.InDebugMode&&console.log("  pushing "+k.debugName),L(e,t,n,s,i,k.beginCaptures,h),i.produce(s,h[0].end),p=h[0].end,w=k.getContentName(t.content,h),C=b.push(e,w),s=s.setContentNameScopesList(C),k.whileHasBackReferences&&(s=s.setEndRule(k.getWhileWithResolvedBackReferences(t.content,h))),!f&&y.hasSameRuleAs(s))return o.DebugFlags.InDebugMode&&console.error("[3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing"),s=s.pop(),i.produce(s,u),void(l=!0)}else {var S=_;if(o.DebugFlags.InDebugMode&&console.log("  matched "+S.debugName+" - "+S.debugMatchRegExp),L(e,t,n,s,i,S.captures,h),i.produce(s,h[0].end),s=s.pop(),!f)return o.DebugFlags.InDebugMode&&console.error("[4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping"),s=s.safePop(),i.produce(s,u),void(l=!0)}}h[0].end>r&&(r=h[0].end,n=!1);}return s}t.Grammar=v;var S=function(){function e(){}return e.toBinaryStr=function(e){for(var t=e.toString(2);t.length<32;)t="0"+t;return t},e.printMetadata=function(t){var n=e.getLanguageId(t),r=e.getTokenType(t),a=e.getFontStyle(t),s=e.getForeground(t),o=e.getBackground(t);console.log({languageId:n,tokenType:r,fontStyle:a,foreground:s,background:o});},e.getLanguageId=function(e){return (255&e)>>>0},e.getTokenType=function(e){return (1792&e)>>>8},e.getFontStyle=function(e){return (14336&e)>>>11},e.getForeground=function(e){return (8372224&e)>>>14},e.getBackground=function(e){return (4286578688&e)>>>23},e.set=function(t,n,r,a,s,o){var i=e.getLanguageId(t),c=e.getTokenType(t),u=e.getFontStyle(t),l=e.getForeground(t),p=e.getBackground(t);return 0!==n&&(i=n),0!==r&&(c=8===r?0:r),-1!==a&&(u=a),0!==s&&(l=s),0!==o&&(p=o),(i<<0|c<<8|u<<11|l<<14|p<<23)>>>0},e}();t.StackElementMetadata=S;var N=function(){function e(e,t,n){this.parent=e,this.scope=t,this.metadata=n;}return e._equals=function(e,t){for(;;){if(e===t)return !0;if(!e&&!t)return !0;if(!e||!t)return !1;if(e.scope!==t.scope||e.metadata!==t.metadata)return !1;e=e.parent,t=t.parent;}},e.prototype.equals=function(t){return e._equals(this,t)},e._matchesScope=function(e,t,n){return t===e||e.substring(0,n.length)===n},e._matches=function(e,t){if(null===t)return !0;for(var n=t.length,r=0,a=t[r],s=a+".";e;){if(this._matchesScope(e.scope,a,s)){if(++r===n)return !0;s=(a=t[r])+".";}e=e.parent;}return !1},e.mergeMetadata=function(e,t,n){if(null===n)return e;var r=-1,a=0,s=0;if(null!==n.themeData)for(var o=0,i=n.themeData.length;o<i;o++){var c=n.themeData[o];if(this._matches(t,c.parentScopes)){r=c.fontStyle,a=c.foreground,s=c.background;break}}return S.set(e,n.languageId,n.tokenType,r,a,s)},e._push=function(t,n,r){for(var a=0,s=r.length;a<s;a++){var o=r[a],i=n.getMetadataForScope(o),c=e.mergeMetadata(t.metadata,t,i);t=new e(t,o,c);}return t},e.prototype.push=function(t,n){return null===n?this:n.indexOf(" ")>=0?e._push(this,t,n.split(/ /g)):e._push(this,t,[n])},e._generateScopes=function(e){for(var t=[],n=0;e;)t[n++]=e.scope,e=e.parent;return t.reverse(),t},e.prototype.generateScopes=function(){return e._generateScopes(this)},e}();t.ScopeListElement=N;var x=function(){function e(e,t,n,r,a,s,o,i){this.parent=e,this.depth=this.parent?this.parent.depth+1:1,this.ruleId=t,this._enterPos=n,this._anchorPos=r,this.beginRuleCapturedEOL=a,this.endRule=s,this.nameScopesList=o,this.contentNameScopesList=i;}return e._structuralEquals=function(e,t){for(;;){if(e===t)return !0;if(!e&&!t)return !0;if(!e||!t)return !1;if(e.depth!==t.depth||e.ruleId!==t.ruleId||e.endRule!==t.endRule)return !1;e=e.parent,t=t.parent;}},e._equals=function(e,t){return e===t||!!this._structuralEquals(e,t)&&e.contentNameScopesList.equals(t.contentNameScopesList)},e.prototype.clone=function(){return this},e.prototype.equals=function(t){return null!==t&&e._equals(this,t)},e._reset=function(e){for(;e;)e._enterPos=-1,e._anchorPos=-1,e=e.parent;},e.prototype.reset=function(){e._reset(this);},e.prototype.pop=function(){return this.parent},e.prototype.safePop=function(){return this.parent?this.parent:this},e.prototype.push=function(t,n,r,a,s,o,i){return new e(this,t,n,r,a,s,o,i)},e.prototype.getEnterPos=function(){return this._enterPos},e.prototype.getAnchorPos=function(){return this._anchorPos},e.prototype.getRule=function(e){return e.getRule(this.ruleId)},e.prototype._writeString=function(e,t){return this.parent&&(t=this.parent._writeString(e,t)),e[t++]="("+this.ruleId+", TODO-"+this.nameScopesList+", TODO-"+this.contentNameScopesList+")",t},e.prototype.toString=function(){var e=[];return this._writeString(e,0),"["+e.join(",")+"]"},e.prototype.setContentNameScopesList=function(e){return this.contentNameScopesList===e?this:this.parent.push(this.ruleId,this._enterPos,this._anchorPos,this.beginRuleCapturedEOL,this.endRule,this.nameScopesList,e)},e.prototype.setEndRule=function(t){return this.endRule===t?this:new e(this.parent,this.ruleId,this._enterPos,this._anchorPos,this.beginRuleCapturedEOL,t,this.nameScopesList,this.contentNameScopesList)},e.prototype.hasSameRuleAs=function(e){return this.ruleId===e.ruleId},e.NULL=new e(null,0,0,0,!1,null,null,null),e}();t.StackElement=x;var P=function(e,t){this.scopes=e,this.endPos=t;};t.LocalStackElement=P;var T=function(){function e(e,t,n){this._emitBinaryTokens=e,this._tokenTypeOverrides=n,o.DebugFlags.InDebugMode?this._lineText=t:this._lineText=null,this._tokens=[],this._binaryTokens=[],this._lastTokenEndIndex=0;}return e.prototype.produce=function(e,t){this.produceFromScopes(e.contentNameScopesList,t);},e.prototype.produceFromScopes=function(e,t){if(!(this._lastTokenEndIndex>=t)){if(this._emitBinaryTokens){for(var n=e.metadata,r=0,a=this._tokenTypeOverrides;r<a.length;r++){var s=a[r];s.matcher(e.generateScopes())&&(n=S.set(n,0,A(s.type),-1,0,0));}return this._binaryTokens.length>0&&this._binaryTokens[this._binaryTokens.length-1]===n||(this._binaryTokens.push(this._lastTokenEndIndex),this._binaryTokens.push(n)),void(this._lastTokenEndIndex=t)}var i=e.generateScopes();if(o.DebugFlags.InDebugMode){console.log("  token: |"+this._lineText.substring(this._lastTokenEndIndex,t).replace(/\n$/,"\\n")+"|");for(var c=0;c<i.length;c++)console.log("      * "+i[c]);}this._tokens.push({startIndex:this._lastTokenEndIndex,endIndex:t,scopes:i}),this._lastTokenEndIndex=t;}},e.prototype.getResult=function(e,t){return this._tokens.length>0&&this._tokens[this._tokens.length-1].startIndex===t-1&&this._tokens.pop(),0===this._tokens.length&&(this._lastTokenEndIndex=-1,this.produce(e,t),this._tokens[this._tokens.length-1].startIndex=0),this._tokens},e.prototype.getBinaryResult=function(e,t){this._binaryTokens.length>0&&this._binaryTokens[this._binaryTokens.length-2]===t-1&&(this._binaryTokens.pop(),this._binaryTokens.pop()),0===this._binaryTokens.length&&(this._lastTokenEndIndex=-1,this.produce(e,t),this._binaryTokens[this._binaryTokens.length-2]=0);for(var n=new Uint32Array(this._binaryTokens.length),r=0,a=this._binaryTokens.length;r<a;r++)n[r]=this._binaryTokens[r];return n},e}();function A(e){switch(e){case 4:return 4;case 2:return 2;case 1:return 1;case 0:default:return 8}}},function(e,t,n){function r(e){return Array.isArray(e)?function(e){for(var t=[],n=0,a=e.length;n<a;n++)t[n]=r(e[n]);return t}(e):"object"==typeof e?function(e){var t={};for(var n in e)t[n]=r(e[n]);return t}(e):e}Object.defineProperty(t,"__esModule",{value:!0}),t.clone=function(e){return r(e)},t.mergeObjects=function(e){for(var t=[],n=1;n<arguments.length;n++)t[n-1]=arguments[n];return t.forEach((function(t){for(var n in t)e[n]=t[n];})),e},t.basename=function e(t){var n=~t.lastIndexOf("/")||~t.lastIndexOf("\\");return 0===n?t:~n==t.length-1?e(t.substring(0,t.length-1)):t.substr(1+~n)};var a=/\$(\d+)|\${(\d+):\/(downcase|upcase)}/,s=function(){function e(){}return e.hasCaptures=function(e){return null!==e&&a.test(e)},e.replaceCaptures=function(e,t,n){return e.replace(a,(function(e,r,a,s){var o=n[parseInt(r||a,10)];if(!o)return e;for(var i=t.substring(o.start,o.end);"."===i[0];)i=i.substring(1);switch(s){case"downcase":return i.toLowerCase();case"upcase":return i.toUpperCase();default:return i}}))},e}();t.RegexSource=s;},function(e,t,n){(function(e){Object.defineProperty(t,"__esModule",{value:!0}),t.DebugFlags={InDebugMode:void 0!==e&&!!e.env.VSCODE_TEXTMATE_DEBUG};}).call(this,n(7));},function(e,t,n){var r=this&&this.__awaiter||function(e,t,n,r){return new(n||(n=Promise))((function(a,s){function o(e){try{c(r.next(e));}catch(e){s(e);}}function i(e){try{c(r.throw(e));}catch(e){s(e);}}function c(e){var t;e.done?a(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t);}))).then(o,i);}c((r=r.apply(e,t||[])).next());}))},a=this&&this.__generator||function(e,t){var n,r,a,s,o={label:0,sent:function(){if(1&a[0])throw a[1];return a[1]},trys:[],ops:[]};return s={next:i(0),throw:i(1),return:i(2)},"function"==typeof Symbol&&(s[Symbol.iterator]=function(){return this}),s;function i(s){return function(i){return function(s){if(n)throw new TypeError("Generator is already executing.");for(;o;)try{if(n=1,r&&(a=2&s[0]?r.return:s[0]?r.throw||((a=r.return)&&a.call(r),0):r.next)&&!(a=a.call(r,s[1])).done)return a;switch(r=0,a&&(s=[2&s[0],a.value]),s[0]){case 0:case 1:a=s;break;case 4:return o.label++,{value:s[1],done:!1};case 5:o.label++,r=s[1],s=[0];continue;case 7:s=o.ops.pop(),o.trys.pop();continue;default:if(!((a=(a=o.trys).length>0&&a[a.length-1])||6!==s[0]&&2!==s[0])){o=0;continue}if(3===s[0]&&(!a||s[1]>a[0]&&s[1]<a[3])){o.label=s[1];break}if(6===s[0]&&o.label<a[1]){o.label=a[1],a=s;break}if(a&&o.label<a[2]){o.label=a[2],o.ops.push(s);break}a[2]&&o.ops.pop(),o.trys.pop();continue}s=t.call(e,o);}catch(e){s=[6,e],r=0;}finally{n=a=0;}if(5&s[0])throw s[1];return {value:s[0]?s[1]:void 0,done:!0}}([s,i])}}};Object.defineProperty(t,"__esModule",{value:!0});var s=n(4),o=n(8),i=n(11),c=n(0),u=function(){function e(e){this._options=e,this._syncRegistry=new s.SyncRegistry(i.Theme.createFromRawTheme(e.theme,e.colorMap),e.onigLib),this._ensureGrammarCache=new Map;}return e.prototype.dispose=function(){this._syncRegistry.dispose();},e.prototype.setTheme=function(e,t){this._syncRegistry.setTheme(i.Theme.createFromRawTheme(e,t));},e.prototype.getColorMap=function(){return this._syncRegistry.getColorMap()},e.prototype.loadGrammarWithEmbeddedLanguages=function(e,t,n){return this.loadGrammarWithConfiguration(e,t,{embeddedLanguages:n})},e.prototype.loadGrammarWithConfiguration=function(e,t,n){return this._loadGrammar(e,t,n.embeddedLanguages,n.tokenTypes)},e.prototype.loadGrammar=function(e){return this._loadGrammar(e,0,null,null)},e.prototype._doLoadSingleGrammar=function(e){return r(this,void 0,void 0,(function(){var t,n;return a(this,(function(r){switch(r.label){case 0:return [4,this._options.loadGrammar(e)];case 1:return (t=r.sent())&&(n="function"==typeof this._options.getInjections?this._options.getInjections(e):void 0,this._syncRegistry.addGrammar(t,n)),[2]}}))}))},e.prototype._loadSingleGrammar=function(e){return r(this,void 0,void 0,(function(){return a(this,(function(t){return this._ensureGrammarCache.has(e)||this._ensureGrammarCache.set(e,this._doLoadSingleGrammar(e)),[2,this._ensureGrammarCache.get(e)]}))}))},e.prototype._collectDependenciesForDep=function(e,t,n){var r=this._syncRegistry.lookup(n.scopeName);if(r){n instanceof c.FullScopeDependency?c.collectDependencies(t,this._syncRegistry.lookup(e),r):c.collectSpecificDependencies(t,this._syncRegistry.lookup(e),r,n.include);var a=this._syncRegistry.injections(n.scopeName);if(a)for(var s=0,o=a;s<o.length;s++){var i=o[s];t.add(new c.FullScopeDependency(i));}}else if(n.scopeName===e)throw new Error("No grammar provided for <"+e+">")},e.prototype._loadGrammar=function(e,t,n,s){return r(this,void 0,void 0,(function(){var r,o,i,u,l,p,h,d,f,g,m,_,y=this;return a(this,(function(a){switch(a.label){case 0:r=new Set,o=new Set,r.add(e),i=[new c.FullScopeDependency(e)],a.label=1;case 1:return i.length>0?(u=i,i=[],[4,Promise.all(u.map((function(e){return y._loadSingleGrammar(e.scopeName)})))]):[3,3];case 2:for(a.sent(),l=new c.ScopeDependencyCollector,p=0,h=u;p<h.length;p++)_=h[p],this._collectDependenciesForDep(e,l,_);for(d=0,f=l.full;d<f.length;d++)_=f[d],r.has(_.scopeName)||(r.add(_.scopeName),i.push(_));for(g=0,m=l.partial;g<m.length;g++)_=m[g],r.has(_.scopeName)||o.has(_.toKey())||(o.add(_.toKey()),i.push(_));return [3,1];case 3:return [2,this.grammarForScopeName(e,t,n,s)]}}))}))},e.prototype.addGrammar=function(e,t,n,s){return void 0===t&&(t=[]),void 0===n&&(n=0),void 0===s&&(s=null),r(this,void 0,void 0,(function(){return a(this,(function(r){switch(r.label){case 0:return this._syncRegistry.addGrammar(e,t),[4,this.grammarForScopeName(e.scopeName,n,s)];case 1:return [2,r.sent()]}}))}))},e.prototype.grammarForScopeName=function(e,t,n,r){return void 0===t&&(t=0),void 0===n&&(n=null),void 0===r&&(r=null),this._syncRegistry.grammarForScopeName(e,t,n,r)},e}();t.Registry=u,t.INITIAL=c.StackElement.NULL,t.parseRawGrammar=o.parseRawGrammar;},function(e,t,n){var r=this&&this.__awaiter||function(e,t,n,r){return new(n||(n=Promise))((function(a,s){function o(e){try{c(r.next(e));}catch(e){s(e);}}function i(e){try{c(r.throw(e));}catch(e){s(e);}}function c(e){var t;e.done?a(e.value):(t=e.value,t instanceof n?t:new n((function(e){e(t);}))).then(o,i);}c((r=r.apply(e,t||[])).next());}))},a=this&&this.__generator||function(e,t){var n,r,a,s,o={label:0,sent:function(){if(1&a[0])throw a[1];return a[1]},trys:[],ops:[]};return s={next:i(0),throw:i(1),return:i(2)},"function"==typeof Symbol&&(s[Symbol.iterator]=function(){return this}),s;function i(s){return function(i){return function(s){if(n)throw new TypeError("Generator is already executing.");for(;o;)try{if(n=1,r&&(a=2&s[0]?r.return:s[0]?r.throw||((a=r.return)&&a.call(r),0):r.next)&&!(a=a.call(r,s[1])).done)return a;switch(r=0,a&&(s=[2&s[0],a.value]),s[0]){case 0:case 1:a=s;break;case 4:return o.label++,{value:s[1],done:!1};case 5:o.label++,r=s[1],s=[0];continue;case 7:s=o.ops.pop(),o.trys.pop();continue;default:if(!((a=(a=o.trys).length>0&&a[a.length-1])||6!==s[0]&&2!==s[0])){o=0;continue}if(3===s[0]&&(!a||s[1]>a[0]&&s[1]<a[3])){o.label=s[1];break}if(6===s[0]&&o.label<a[1]){o.label=a[1],a=s;break}if(a&&o.label<a[2]){o.label=a[2],o.ops.push(s);break}a[2]&&o.ops.pop(),o.trys.pop();continue}s=t.call(e,o);}catch(e){s=[6,e],r=0;}finally{n=a=0;}if(5&s[0])throw s[1];return {value:s[0]?s[1]:void 0,done:!0}}([s,i])}}};Object.defineProperty(t,"__esModule",{value:!0});var s=n(0),o=function(){function e(e,t){this._theme=e,this._grammars={},this._rawGrammars={},this._injectionGrammars={},this._onigLibPromise=t;}return e.prototype.dispose=function(){for(var e in this._grammars)this._grammars.hasOwnProperty(e)&&this._grammars[e].dispose();},e.prototype.setTheme=function(e){var t=this;this._theme=e,Object.keys(this._grammars).forEach((function(e){t._grammars[e].onDidChangeTheme();}));},e.prototype.getColorMap=function(){return this._theme.getColorMap()},e.prototype.addGrammar=function(e,t){this._rawGrammars[e.scopeName]=e,t&&(this._injectionGrammars[e.scopeName]=t);},e.prototype.lookup=function(e){return this._rawGrammars[e]},e.prototype.injections=function(e){return this._injectionGrammars[e]},e.prototype.getDefaults=function(){return this._theme.getDefaults()},e.prototype.themeMatch=function(e){return this._theme.match(e)},e.prototype.grammarForScopeName=function(e,t,n,o){return r(this,void 0,void 0,(function(){var r,i,c,u,l;return a(this,(function(a){switch(a.label){case 0:return this._grammars[e]?[3,2]:(r=this._rawGrammars[e])?(i=this._grammars,c=e,u=s.createGrammar,l=[r,t,n,o,this],[4,this._onigLibPromise]):[2,null];case 1:i[c]=u.apply(void 0,l.concat([a.sent()])),a.label=2;case 2:return [2,this._grammars[e]]}}))}))},e}();t.SyncRegistry=o;},function(e,t,n){var r,a=this&&this.__extends||(r=function(e,t){return (r=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t;}||function(e,t){for(var n in t)t.hasOwnProperty(n)&&(e[n]=t[n]);})(e,t)},function(e,t){function n(){this.constructor=e;}r(e,t),e.prototype=null===t?Object.create(t):(n.prototype=t.prototype,new n);});Object.defineProperty(t,"__esModule",{value:!0});var s=n(1),o=/\\(\d+)/,i=/\\(\d+)/g,c=function(){function e(e,t,n){this.debugRegExps=t,this.rules=n,this.scanner=e.createOnigScanner(t);}return e.prototype.dispose=function(){"function"==typeof this.scanner.dispose&&this.scanner.dispose();},e}();t.CompiledRule=c;var u=function(){function e(e,t,n,r){this.$location=e,this.id=t,this._name=n||null,this._nameIsCapturing=s.RegexSource.hasCaptures(this._name),this._contentName=r||null,this._contentNameIsCapturing=s.RegexSource.hasCaptures(this._contentName);}return Object.defineProperty(e.prototype,"debugName",{get:function(){var e=this.$location?s.basename(this.$location.filename)+":"+this.$location.line:"unknown";return this.constructor.name+"#"+this.id+" @ "+e},enumerable:!0,configurable:!0}),e.prototype.getName=function(e,t){return this._nameIsCapturing&&null!==this._name&&null!==e&&null!==t?s.RegexSource.replaceCaptures(this._name,e,t):this._name},e.prototype.getContentName=function(e,t){return this._contentNameIsCapturing&&null!==this._contentName?s.RegexSource.replaceCaptures(this._contentName,e,t):this._contentName},e}();t.Rule=u;var l=function(e){function t(t,n,r,a,s){var o=e.call(this,t,n,r,a)||this;return o.retokenizeCapturedWithRuleId=s,o}return a(t,e),t.prototype.dispose=function(){},t.prototype.collectPatternsRecursive=function(e,t,n){throw new Error("Not supported!")},t.prototype.compile=function(e,t,n,r){throw new Error("Not supported!")},t}(u);t.CaptureRule=l;var p=function(){function e(e,t,n){if(void 0===n&&(n=!0),n)if(e){for(var r=e.length,a=0,s=[],i=!1,c=0;c<r;c++)if("\\"===e.charAt(c)&&c+1<r){var u=e.charAt(c+1);"z"===u?(s.push(e.substring(a,c)),s.push("$(?!\\n)(?<!\\n)"),a=c+2):"A"!==u&&"G"!==u||(i=!0),c++;}this.hasAnchor=i,0===a?this.source=e:(s.push(e.substring(a,r)),this.source=s.join(""));}else this.hasAnchor=!1,this.source=e;else this.hasAnchor=!1,this.source=e;this.hasAnchor?this._anchorCache=this._buildAnchorCache():this._anchorCache=null,this.ruleId=t,this.hasBackReferences=o.test(this.source);}return e.prototype.clone=function(){return new e(this.source,this.ruleId,!0)},e.prototype.setSource=function(e){this.source!==e&&(this.source=e,this.hasAnchor&&(this._anchorCache=this._buildAnchorCache()));},e.prototype.resolveBackReferences=function(e,t){var n=t.map((function(t){return e.substring(t.start,t.end)}));return i.lastIndex=0,this.source.replace(i,(function(e,t){return (n[parseInt(t,10)]||"").replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g,"\\$&")}))},e.prototype._buildAnchorCache=function(){var e,t,n,r,a=[],s=[],o=[],i=[];for(e=0,t=this.source.length;e<t;e++)n=this.source.charAt(e),a[e]=n,s[e]=n,o[e]=n,i[e]=n,"\\"===n&&e+1<t&&("A"===(r=this.source.charAt(e+1))?(a[e+1]="￿",s[e+1]="￿",o[e+1]="A",i[e+1]="A"):"G"===r?(a[e+1]="￿",s[e+1]="G",o[e+1]="￿",i[e+1]="G"):(a[e+1]=r,s[e+1]=r,o[e+1]=r,i[e+1]=r),e++);return {A0_G0:a.join(""),A0_G1:s.join(""),A1_G0:o.join(""),A1_G1:i.join("")}},e.prototype.resolveAnchors=function(e,t){return this.hasAnchor&&this._anchorCache?e?t?this._anchorCache.A1_G1:this._anchorCache.A1_G0:t?this._anchorCache.A0_G1:this._anchorCache.A0_G0:this.source},e}();t.RegExpSource=p;var h=function(){function e(){this._items=[],this._hasAnchors=!1,this._cached=null,this._anchorCache={A0_G0:null,A0_G1:null,A1_G0:null,A1_G1:null};}return e.prototype.dispose=function(){this._disposeCaches();},e.prototype._disposeCaches=function(){this._cached&&(this._cached.dispose(),this._cached=null),this._anchorCache.A0_G0&&(this._anchorCache.A0_G0.dispose(),this._anchorCache.A0_G0=null),this._anchorCache.A0_G1&&(this._anchorCache.A0_G1.dispose(),this._anchorCache.A0_G1=null),this._anchorCache.A1_G0&&(this._anchorCache.A1_G0.dispose(),this._anchorCache.A1_G0=null),this._anchorCache.A1_G1&&(this._anchorCache.A1_G1.dispose(),this._anchorCache.A1_G1=null);},e.prototype.push=function(e){this._items.push(e),this._hasAnchors=this._hasAnchors||e.hasAnchor;},e.prototype.unshift=function(e){this._items.unshift(e),this._hasAnchors=this._hasAnchors||e.hasAnchor;},e.prototype.length=function(){return this._items.length},e.prototype.setSource=function(e,t){this._items[e].source!==t&&(this._disposeCaches(),this._items[e].setSource(t));},e.prototype.compile=function(e,t,n){if(this._hasAnchors)return t?n?(this._anchorCache.A1_G1||(this._anchorCache.A1_G1=this._resolveAnchors(e,t,n)),this._anchorCache.A1_G1):(this._anchorCache.A1_G0||(this._anchorCache.A1_G0=this._resolveAnchors(e,t,n)),this._anchorCache.A1_G0):n?(this._anchorCache.A0_G1||(this._anchorCache.A0_G1=this._resolveAnchors(e,t,n)),this._anchorCache.A0_G1):(this._anchorCache.A0_G0||(this._anchorCache.A0_G0=this._resolveAnchors(e,t,n)),this._anchorCache.A0_G0);if(!this._cached){var r=this._items.map((function(e){return e.source}));this._cached=new c(e,r,this._items.map((function(e){return e.ruleId})));}return this._cached},e.prototype._resolveAnchors=function(e,t,n){var r=this._items.map((function(e){return e.resolveAnchors(t,n)}));return new c(e,r,this._items.map((function(e){return e.ruleId})))},e}();t.RegExpSourceList=h;var d=function(e){function t(t,n,r,a,s){var o=e.call(this,t,n,r,null)||this;return o._match=new p(a,o.id),o.captures=s,o._cachedCompiledPatterns=null,o}return a(t,e),t.prototype.dispose=function(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null);},Object.defineProperty(t.prototype,"debugMatchRegExp",{get:function(){return ""+this._match.source},enumerable:!0,configurable:!0}),t.prototype.collectPatternsRecursive=function(e,t,n){t.push(this._match);},t.prototype.compile=function(e,t,n,r){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new h,this.collectPatternsRecursive(e,this._cachedCompiledPatterns,!0)),this._cachedCompiledPatterns.compile(e,n,r)},t}(u);t.MatchRule=d;var f=function(e){function t(t,n,r,a,s){var o=e.call(this,t,n,r,a)||this;return o.patterns=s.patterns,o.hasMissingPatterns=s.hasMissingPatterns,o._cachedCompiledPatterns=null,o}return a(t,e),t.prototype.dispose=function(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null);},t.prototype.collectPatternsRecursive=function(e,t,n){var r,a;for(r=0,a=this.patterns.length;r<a;r++)e.getRule(this.patterns[r]).collectPatternsRecursive(e,t,!1);},t.prototype.compile=function(e,t,n,r){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new h,this.collectPatternsRecursive(e,this._cachedCompiledPatterns,!0)),this._cachedCompiledPatterns.compile(e,n,r)},t}(u);t.IncludeOnlyRule=f;var g=function(e){function t(t,n,r,a,s,o,i,c,u,l){var h=e.call(this,t,n,r,a)||this;return h._begin=new p(s,h.id),h.beginCaptures=o,h._end=new p(i||"￿",-1),h.endHasBackReferences=h._end.hasBackReferences,h.endCaptures=c,h.applyEndPatternLast=u||!1,h.patterns=l.patterns,h.hasMissingPatterns=l.hasMissingPatterns,h._cachedCompiledPatterns=null,h}return a(t,e),t.prototype.dispose=function(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null);},Object.defineProperty(t.prototype,"debugBeginRegExp",{get:function(){return ""+this._begin.source},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"debugEndRegExp",{get:function(){return ""+this._end.source},enumerable:!0,configurable:!0}),t.prototype.getEndWithResolvedBackReferences=function(e,t){return this._end.resolveBackReferences(e,t)},t.prototype.collectPatternsRecursive=function(e,t,n){if(n){var r,a=void 0;for(a=0,r=this.patterns.length;a<r;a++)e.getRule(this.patterns[a]).collectPatternsRecursive(e,t,!1);}else t.push(this._begin);},t.prototype.compile=function(e,t,n,r){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new h,this.collectPatternsRecursive(e,this._cachedCompiledPatterns,!0),this.applyEndPatternLast?this._cachedCompiledPatterns.push(this._end.hasBackReferences?this._end.clone():this._end):this._cachedCompiledPatterns.unshift(this._end.hasBackReferences?this._end.clone():this._end)),this._end.hasBackReferences&&(this.applyEndPatternLast?this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length()-1,t):this._cachedCompiledPatterns.setSource(0,t)),this._cachedCompiledPatterns.compile(e,n,r)},t}(u);t.BeginEndRule=g;var m=function(e){function t(t,n,r,a,s,o,i,c,u){var l=e.call(this,t,n,r,a)||this;return l._begin=new p(s,l.id),l.beginCaptures=o,l.whileCaptures=c,l._while=new p(i,-2),l.whileHasBackReferences=l._while.hasBackReferences,l.patterns=u.patterns,l.hasMissingPatterns=u.hasMissingPatterns,l._cachedCompiledPatterns=null,l._cachedCompiledWhilePatterns=null,l}return a(t,e),t.prototype.dispose=function(){this._cachedCompiledPatterns&&(this._cachedCompiledPatterns.dispose(),this._cachedCompiledPatterns=null),this._cachedCompiledWhilePatterns&&(this._cachedCompiledWhilePatterns.dispose(),this._cachedCompiledWhilePatterns=null);},Object.defineProperty(t.prototype,"debugBeginRegExp",{get:function(){return ""+this._begin.source},enumerable:!0,configurable:!0}),Object.defineProperty(t.prototype,"debugWhileRegExp",{get:function(){return ""+this._while.source},enumerable:!0,configurable:!0}),t.prototype.getWhileWithResolvedBackReferences=function(e,t){return this._while.resolveBackReferences(e,t)},t.prototype.collectPatternsRecursive=function(e,t,n){if(n){var r,a=void 0;for(a=0,r=this.patterns.length;a<r;a++)e.getRule(this.patterns[a]).collectPatternsRecursive(e,t,!1);}else t.push(this._begin);},t.prototype.compile=function(e,t,n,r){return this._cachedCompiledPatterns||(this._cachedCompiledPatterns=new h,this.collectPatternsRecursive(e,this._cachedCompiledPatterns,!0)),this._cachedCompiledPatterns.compile(e,n,r)},t.prototype.compileWhile=function(e,t,n,r){return this._cachedCompiledWhilePatterns||(this._cachedCompiledWhilePatterns=new h,this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences?this._while.clone():this._while)),this._while.hasBackReferences&&this._cachedCompiledWhilePatterns.setSource(0,t||"￿"),this._cachedCompiledWhilePatterns.compile(e,n,r)},t}(u);t.BeginWhileRule=m;var _=function(){function e(){}return e.createCaptureRule=function(e,t,n,r,a){return e.registerRule((function(e){return new l(t,e,n,r,a)}))},e.getCompiledRuleId=function(t,n,r){return t.id||n.registerRule((function(a){if(t.id=a,t.match)return new d(t.$vscodeTextmateLocation,t.id,t.name,t.match,e._compileCaptures(t.captures,n,r));if(void 0===t.begin){t.repository&&(r=s.mergeObjects({},r,t.repository));var o=t.patterns;return void 0===o&&t.include&&(o=[{include:t.include}]),new f(t.$vscodeTextmateLocation,t.id,t.name,t.contentName,e._compilePatterns(o,n,r))}return t.while?new m(t.$vscodeTextmateLocation,t.id,t.name,t.contentName,t.begin,e._compileCaptures(t.beginCaptures||t.captures,n,r),t.while,e._compileCaptures(t.whileCaptures||t.captures,n,r),e._compilePatterns(t.patterns,n,r)):new g(t.$vscodeTextmateLocation,t.id,t.name,t.contentName,t.begin,e._compileCaptures(t.beginCaptures||t.captures,n,r),t.end,e._compileCaptures(t.endCaptures||t.captures,n,r),t.applyEndPatternLast,e._compilePatterns(t.patterns,n,r))})),t.id},e._compileCaptures=function(t,n,r){var a=[];if(t){var s=0;for(var o in t)"$vscodeTextmateLocation"!==o&&(c=parseInt(o,10))>s&&(s=c);for(var i=0;i<=s;i++)a[i]=null;for(var o in t)if("$vscodeTextmateLocation"!==o){var c=parseInt(o,10),u=0;t[o].patterns&&(u=e.getCompiledRuleId(t[o],n,r)),a[c]=e.createCaptureRule(n,t[o].$vscodeTextmateLocation,t[o].name,t[o].contentName,u);}}return a},e._compilePatterns=function(t,n,r){var a=[];if(t)for(var s=0,o=t.length;s<o;s++){var i=t[s],c=-1;if(i.include)if("#"===i.include.charAt(0)){var u=r[i.include.substr(1)];u&&(c=e.getCompiledRuleId(u,n,r));}else if("$base"===i.include||"$self"===i.include)c=e.getCompiledRuleId(r[i.include],n,r);else {var l=null,p=null,h=i.include.indexOf("#");h>=0?(l=i.include.substring(0,h),p=i.include.substring(h+1)):l=i.include;var d=n.getExternalGrammar(l,r);if(d)if(p){var _=d.repository[p];_&&(c=e.getCompiledRuleId(_,n,d.repository));}else c=e.getCompiledRuleId(d.repository.$self,n,d.repository);}else c=e.getCompiledRuleId(i,n,r);if(-1!==c){var y=n.getRule(c),v=!1;if((y instanceof f||y instanceof g||y instanceof m)&&y.hasMissingPatterns&&0===y.patterns.length&&(v=!0),v)continue;a.push(c);}}return {patterns:a,hasMissingPatterns:(t?t.length:0)!==a.length}},e}();t.RuleFactory=_;},function(e,t,n){function r(e){return !!e&&!!e.match(/[\w\.:]+/)}Object.defineProperty(t,"__esModule",{value:!0}),t.createMatchers=function(e,t){for(var n,a,s,o=[],i=(s=(a=/([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g).exec(n=e),{next:function(){if(!s)return null;var e=s[0];return s=a.exec(n),e}}),c=i.next();null!==c;){var u=0;if(2===c.length&&":"===c.charAt(1)){switch(c.charAt(0)){case"R":u=1;break;case"L":u=-1;break;default:console.log("Unknown priority "+c+" in scope selector");}c=i.next();}var l=h();if(o.push({matcher:l,priority:u}),","!==c)break;c=i.next();}return o;function p(){if("-"===c){c=i.next();var e=p();return function(t){return !!e&&!e(t)}}if("("===c){c=i.next();var n=function(){for(var e=[],t=h();t&&(e.push(t),"|"===c||","===c);){do{c=i.next();}while("|"===c||","===c);t=h();}return function(t){return e.some((function(e){return e(t)}))}}();return ")"===c&&(c=i.next()),n}if(r(c)){var a=[];do{a.push(c),c=i.next();}while(r(c));return function(e){return t(a,e)}}return null}function h(){for(var e=[],t=p();t;)e.push(t),t=p();return function(t){return e.every((function(e){return e(t)}))}}};},function(e,t){var n,r,a=e.exports={};function s(){throw new Error("setTimeout has not been defined")}function o(){throw new Error("clearTimeout has not been defined")}function i(e){if(n===setTimeout)return setTimeout(e,0);if((n===s||!n)&&setTimeout)return n=setTimeout,setTimeout(e,0);try{return n(e,0)}catch(t){try{return n.call(null,e,0)}catch(t){return n.call(this,e,0)}}}!function(){try{n="function"==typeof setTimeout?setTimeout:s;}catch(e){n=s;}try{r="function"==typeof clearTimeout?clearTimeout:o;}catch(e){r=o;}}();var c,u=[],l=!1,p=-1;function h(){l&&c&&(l=!1,c.length?u=c.concat(u):p=-1,u.length&&d());}function d(){if(!l){var e=i(h);l=!0;for(var t=u.length;t;){for(c=u,u=[];++p<t;)c&&c[p].run();p=-1,t=u.length;}c=null,l=!1,function(e){if(r===clearTimeout)return clearTimeout(e);if((r===o||!r)&&clearTimeout)return r=clearTimeout,clearTimeout(e);try{r(e);}catch(t){try{return r.call(null,e)}catch(t){return r.call(this,e)}}}(e);}}function f(e,t){this.fun=e,this.array=t;}function g(){}a.nextTick=function(e){var t=new Array(arguments.length-1);if(arguments.length>1)for(var n=1;n<arguments.length;n++)t[n-1]=arguments[n];u.push(new f(e,t)),1!==u.length||l||i(d);},f.prototype.run=function(){this.fun.apply(null,this.array);},a.title="browser",a.browser=!0,a.env={},a.argv=[],a.version="",a.versions={},a.on=g,a.addListener=g,a.once=g,a.off=g,a.removeListener=g,a.removeAllListeners=g,a.emit=g,a.prependListener=g,a.prependOnceListener=g,a.listeners=function(e){return []},a.binding=function(e){throw new Error("process.binding is not supported")},a.cwd=function(){return "/"},a.chdir=function(e){throw new Error("process.chdir is not supported")},a.umask=function(){return 0};},function(e,t,n){Object.defineProperty(t,"__esModule",{value:!0});var r=n(9),a=n(2),s=n(10);t.parseRawGrammar=function(e,t){return void 0===t&&(t=null),null!==t&&/\.json$/.test(t)?function(e,t){return a.DebugFlags.InDebugMode?s.parse(e,t,!0):JSON.parse(e)}(e,t):function(e,t){return a.DebugFlags.InDebugMode?r.parseWithLocation(e,t,"$vscodeTextmateLocation"):r.parse(e)}(e,t)};},function(e,t,n){function r(e,t,n){var r=e.length,a=0,s=1,o=0;function i(t){if(null===n)a+=t;else for(;t>0;)10===e.charCodeAt(a)?(a++,s++,o=0):(a++,o++),t--;}function c(e){null===n?a=e:i(e-a);}function u(){for(;a<r;){var t=e.charCodeAt(a);if(32!==t&&9!==t&&13!==t&&10!==t)break;i(1);}}function l(t){return e.substr(a,t.length)===t&&(i(t.length),!0)}function p(t){var n=e.indexOf(t,a);c(-1!==n?n+t.length:r);}function h(t){var n=e.indexOf(t,a);if(-1!==n){var s=e.substring(a,n);return c(n+t.length),s}return s=e.substr(a),c(r),s}r>0&&65279===e.charCodeAt(0)&&(a=1);var d=0,f=null,g=[],m=[],_=null;function y(e,t){g.push(d),m.push(f),d=e,f=t;}function v(){if(0===g.length)return b("illegal state stack");d=g.pop(),f=m.pop();}function b(t){throw new Error("Near offset "+a+": "+t+" ~~~"+e.substr(a,50)+"~~~")}var k,L,w,j=function(){if(null===_)return b("missing <key>");var e={};null!==n&&(e[n]={filename:t,line:s,char:o}),f[_]=e,_=null,y(1,e);},C=function(){if(null===_)return b("missing <key>");var e=[];f[_]=e,_=null,y(2,e);},S=function(){var e={};null!==n&&(e[n]={filename:t,line:s,char:o}),f.push(e),y(1,e);},N=function(){var e=[];f.push(e),y(2,e);};function x(){if(1!==d)return b("unexpected </dict>");v();}function P(){return 1===d||2!==d?b("unexpected </array>"):void v()}function T(e){if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function A(e){if(isNaN(e))return b("cannot parse float");if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function R(e){if(isNaN(e))return b("cannot parse integer");if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function I(e){if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function O(e){if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function E(e){if(1===d){if(null===_)return b("missing <key>");f[_]=e,_=null;}else 2===d?f.push(e):f=e;}function M(e){if(e.isClosed)return "";var t=h("</");return p(">"),t.replace(/&#([0-9]+);/g,(function(e,t){return String.fromCodePoint(parseInt(t,10))})).replace(/&#x([0-9a-f]+);/g,(function(e,t){return String.fromCodePoint(parseInt(t,16))})).replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g,(function(e){switch(e){case"&amp;":return "&";case"&lt;":return "<";case"&gt;":return ">";case"&quot;":return '"';case"&apos;":return "'"}return e}))}for(;a<r&&(u(),!(a>=r));){var D=e.charCodeAt(a);if(i(1),60!==D)return b("expected <");if(a>=r)return b("unexpected end of input");var G=e.charCodeAt(a);if(63!==G)if(33!==G){if(47===G){if(i(1),u(),l("plist")){p(">");continue}if(l("dict")){p(">"),x();continue}if(l("array")){p(">"),P();continue}return b("unexpected closed tag")}var F=(L=void 0,w=void 0,w=!1,47===(L=h(">")).charCodeAt(L.length-1)&&(w=!0,L=L.substring(0,L.length-1)),{name:L.trim(),isClosed:w});switch(F.name){case"dict":1===d?j():2===d?S():(f={},null!==n&&(f[n]={filename:t,line:s,char:o}),y(1,f)),F.isClosed&&x();continue;case"array":1===d?C():2===d?N():y(2,f=[]),F.isClosed&&P();continue;case"key":k=M(F),1!==d?b("unexpected <key>"):null!==_?b("too many <key>"):_=k;continue;case"string":T(M(F));continue;case"real":A(parseFloat(M(F)));continue;case"integer":R(parseInt(M(F),10));continue;case"date":I(new Date(M(F)));continue;case"data":O(M(F));continue;case"true":M(F),E(!0);continue;case"false":M(F),E(!1);continue}if(!/^plist/.test(F.name))return b("unexpected opened tag "+F.name)}else {if(i(1),l("--")){p("--\x3e");continue}p(">");}else i(1),p("?>");}return f}Object.defineProperty(t,"__esModule",{value:!0}),t.parseWithLocation=function(e,t,n){return r(e,t,n)},t.parse=function(e){return r(e,null,null)};},function(e,t,n){function r(e,t){throw new Error("Near offset "+e.pos+": "+t+" ~~~"+e.source.substr(e.pos,50)+"~~~")}Object.defineProperty(t,"__esModule",{value:!0}),t.parse=function(e,t,n){var i=new a(e),c=new s,u=0,l=null,p=[],h=[];function d(){p.push(u),h.push(l);}function f(){u=p.pop(),l=h.pop();}function g(e){r(i,e);}for(;o(i,c);){if(0===u){if(null!==l&&g("too many constructs in root"),3===c.type){l={},n&&(l.$vscodeTextmateLocation=c.toLocation(t)),d(),u=1;continue}if(2===c.type){l=[],d(),u=4;continue}g("unexpected token in root");}if(2===u){if(5===c.type){f();continue}if(7===c.type){u=3;continue}g("expected , or }");}if(1===u||3===u){if(1===u&&5===c.type){f();continue}if(1===c.type){var m=c.value;if(o(i,c)&&6===c.type||g("expected colon"),o(i,c)||g("expected value"),u=2,1===c.type){l[m]=c.value;continue}if(8===c.type){l[m]=null;continue}if(9===c.type){l[m]=!0;continue}if(10===c.type){l[m]=!1;continue}if(11===c.type){l[m]=parseFloat(c.value);continue}if(2===c.type){var _=[];l[m]=_,d(),u=4,l=_;continue}if(3===c.type){var y={};n&&(y.$vscodeTextmateLocation=c.toLocation(t)),l[m]=y,d(),u=1,l=y;continue}}g("unexpected token in dict");}if(5===u){if(4===c.type){f();continue}if(7===c.type){u=6;continue}g("expected , or ]");}if(4===u||6===u){if(4===u&&4===c.type){f();continue}if(u=5,1===c.type){l.push(c.value);continue}if(8===c.type){l.push(null);continue}if(9===c.type){l.push(!0);continue}if(10===c.type){l.push(!1);continue}if(11===c.type){l.push(parseFloat(c.value));continue}if(2===c.type){_=[],l.push(_),d(),u=4,l=_;continue}if(3===c.type){y={},n&&(y.$vscodeTextmateLocation=c.toLocation(t)),l.push(y),d(),u=1,l=y;continue}g("unexpected token in array");}g("unknown state");}return 0!==h.length&&g("unclosed constructs"),l};var a=function(e){this.source=e,this.pos=0,this.len=e.length,this.line=1,this.char=0;},s=function(){function e(){this.value=null,this.type=0,this.offset=-1,this.len=-1,this.line=-1,this.char=-1;}return e.prototype.toLocation=function(e){return {filename:e,line:this.line,char:this.char}},e}();function o(e,t){t.value=null,t.type=0,t.offset=-1,t.len=-1,t.line=-1,t.char=-1;for(var n,a=e.source,s=e.pos,o=e.len,i=e.line,c=e.char;;){if(s>=o)return !1;if(32!==(n=a.charCodeAt(s))&&9!==n&&13!==n){if(10!==n)break;s++,i++,c=0;}else s++,c++;}if(t.offset=s,t.line=i,t.char=c,34===n){for(t.type=1,s++,c++;;){if(s>=o)return !1;if(n=a.charCodeAt(s),s++,c++,92!==n){if(34===n)break}else s++,c++;}t.value=a.substring(t.offset+1,s-1).replace(/\\u([0-9A-Fa-f]{4})/g,(function(e,t){return String.fromCodePoint(parseInt(t,16))})).replace(/\\(.)/g,(function(t,n){switch(n){case'"':return '"';case"\\":return "\\";case"/":return "/";case"b":return "\b";case"f":return "\f";case"n":return "\n";case"r":return "\r";case"t":return "\t";default:r(e,"invalid escape sequence");}throw new Error("unreachable")}));}else if(91===n)t.type=2,s++,c++;else if(123===n)t.type=3,s++,c++;else if(93===n)t.type=4,s++,c++;else if(125===n)t.type=5,s++,c++;else if(58===n)t.type=6,s++,c++;else if(44===n)t.type=7,s++,c++;else if(110===n){if(t.type=8,s++,c++,117!==(n=a.charCodeAt(s)))return !1;if(s++,c++,108!==(n=a.charCodeAt(s)))return !1;if(s++,c++,108!==(n=a.charCodeAt(s)))return !1;s++,c++;}else if(116===n){if(t.type=9,s++,c++,114!==(n=a.charCodeAt(s)))return !1;if(s++,c++,117!==(n=a.charCodeAt(s)))return !1;if(s++,c++,101!==(n=a.charCodeAt(s)))return !1;s++,c++;}else if(102===n){if(t.type=10,s++,c++,97!==(n=a.charCodeAt(s)))return !1;if(s++,c++,108!==(n=a.charCodeAt(s)))return !1;if(s++,c++,115!==(n=a.charCodeAt(s)))return !1;if(s++,c++,101!==(n=a.charCodeAt(s)))return !1;s++,c++;}else for(t.type=11;;){if(s>=o)return !1;if(!(46===(n=a.charCodeAt(s))||n>=48&&n<=57||101===n||69===n||45===n||43===n))break;s++,c++;}return t.len=s-t.offset,null===t.value&&(t.value=a.substr(t.offset,t.len)),e.pos=s,e.line=i,e.char=c,!0}},function(e,t,n){Object.defineProperty(t,"__esModule",{value:!0});var r=function(e,t,n,r,a,s){this.scope=e,this.parentScopes=t,this.index=n,this.fontStyle=r,this.foreground=a,this.background=s;};function a(e){return !!(/^#[0-9a-f]{6}$/i.test(e)||/^#[0-9a-f]{8}$/i.test(e)||/^#[0-9a-f]{3}$/i.test(e)||/^#[0-9a-f]{4}$/i.test(e))}function s(e){if(!e)return [];if(!e.settings||!Array.isArray(e.settings))return [];for(var t=e.settings,n=[],s=0,o=0,i=t.length;o<i;o++){var c=t[o];if(c.settings){var u=void 0;u="string"==typeof c.scope?c.scope.replace(/^[,]+/,"").replace(/[,]+$/,"").split(","):Array.isArray(c.scope)?c.scope:[""];var l=-1;if("string"==typeof c.settings.fontStyle){l=0;for(var p=0,h=(g=c.settings.fontStyle.split(" ")).length;p<h;p++)switch(g[p]){case"italic":l|=1;break;case"bold":l|=2;break;case"underline":l|=4;}}var d=null;"string"==typeof c.settings.foreground&&a(c.settings.foreground)&&(d=c.settings.foreground);var f=null;for("string"==typeof c.settings.background&&a(c.settings.background)&&(f=c.settings.background),p=0,h=u.length;p<h;p++){var g,m=(g=u[p].trim().split(" "))[g.length-1],_=null;g.length>1&&(_=g.slice(0,g.length-1)).reverse(),n[s++]=new r(m,_,o,l,d,f);}}}return n}function o(e,t){e.sort((function(e,t){var n=u(e.scope,t.scope);return 0!==n||0!==(n=l(e.parentScopes,t.parentScopes))?n:e.index-t.index}));for(var n=0,r="#000000",a="#ffffff";e.length>=1&&""===e[0].scope;){var s=e.shift();-1!==s.fontStyle&&(n=s.fontStyle),null!==s.foreground&&(r=s.foreground),null!==s.background&&(a=s.background);}for(var o=new i(t),d=new p(0,null,n,o.getId(r),o.getId(a)),f=new h(new p(0,null,-1,0,0),[]),g=0,m=e.length;g<m;g++){var _=e[g];f.insert(0,_.scope,_.parentScopes,_.fontStyle,o.getId(_.foreground),o.getId(_.background));}return new c(o,d,f)}t.ParsedThemeRule=r,t.parseTheme=s;var i=function(){function e(e){if(this._lastColorId=0,this._id2color=[],this._color2id=Object.create(null),Array.isArray(e)){this._isFrozen=!0;for(var t=0,n=e.length;t<n;t++)this._color2id[e[t]]=t,this._id2color[t]=e[t];}else this._isFrozen=!1;}return e.prototype.getId=function(e){if(null===e)return 0;e=e.toUpperCase();var t=this._color2id[e];if(t)return t;if(this._isFrozen)throw new Error("Missing color in color map - "+e);return t=++this._lastColorId,this._color2id[e]=t,this._id2color[t]=e,t},e.prototype.getColorMap=function(){return this._id2color.slice(0)},e}();t.ColorMap=i;var c=function(){function e(e,t,n){this._colorMap=e,this._root=n,this._defaults=t,this._cache={};}return e.createFromRawTheme=function(e,t){return this.createFromParsedTheme(s(e),t)},e.createFromParsedTheme=function(e,t){return o(e,t)},e.prototype.getColorMap=function(){return this._colorMap.getColorMap()},e.prototype.getDefaults=function(){return this._defaults},e.prototype.match=function(e){return this._cache.hasOwnProperty(e)||(this._cache[e]=this._root.match(e)),this._cache[e]},e}();function u(e,t){return e<t?-1:e>t?1:0}function l(e,t){if(null===e&&null===t)return 0;if(!e)return -1;if(!t)return 1;var n=e.length,r=t.length;if(n===r){for(var a=0;a<n;a++){var s=u(e[a],t[a]);if(0!==s)return s}return 0}return n-r}t.Theme=c,t.strcmp=u,t.strArrCmp=l;var p=function(){function e(e,t,n,r,a){this.scopeDepth=e,this.parentScopes=t,this.fontStyle=n,this.foreground=r,this.background=a;}return e.prototype.clone=function(){return new e(this.scopeDepth,this.parentScopes,this.fontStyle,this.foreground,this.background)},e.cloneArr=function(e){for(var t=[],n=0,r=e.length;n<r;n++)t[n]=e[n].clone();return t},e.prototype.acceptOverwrite=function(e,t,n,r){this.scopeDepth>e?console.log("how did this happen?"):this.scopeDepth=e,-1!==t&&(this.fontStyle=t),0!==n&&(this.foreground=n),0!==r&&(this.background=r);},e}();t.ThemeTrieElementRule=p;var h=function(){function e(e,t,n){void 0===t&&(t=[]),void 0===n&&(n={}),this._mainRule=e,this._rulesWithParentScopes=t,this._children=n;}return e._sortBySpecificity=function(e){return 1===e.length||e.sort(this._cmpBySpecificity),e},e._cmpBySpecificity=function(e,t){if(e.scopeDepth===t.scopeDepth){var n=e.parentScopes,r=t.parentScopes,a=null===n?0:n.length,s=null===r?0:r.length;if(a===s)for(var o=0;o<a;o++){var i=n[o].length,c=r[o].length;if(i!==c)return c-i}return s-a}return t.scopeDepth-e.scopeDepth},e.prototype.match=function(t){if(""===t)return e._sortBySpecificity([].concat(this._mainRule).concat(this._rulesWithParentScopes));var n,r,a=t.indexOf(".");return -1===a?(n=t,r=""):(n=t.substring(0,a),r=t.substring(a+1)),this._children.hasOwnProperty(n)?this._children[n].match(r):e._sortBySpecificity([].concat(this._mainRule).concat(this._rulesWithParentScopes))},e.prototype.insert=function(t,n,r,a,s,o){if(""!==n){var i,c,u,l=n.indexOf(".");-1===l?(i=n,c=""):(i=n.substring(0,l),c=n.substring(l+1)),this._children.hasOwnProperty(i)?u=this._children[i]:(u=new e(this._mainRule.clone(),p.cloneArr(this._rulesWithParentScopes)),this._children[i]=u),u.insert(t+1,c,r,a,s,o);}else this._doInsertHere(t,r,a,s,o);},e.prototype._doInsertHere=function(e,t,n,r,a){if(null!==t){for(var s=0,o=this._rulesWithParentScopes.length;s<o;s++){var i=this._rulesWithParentScopes[s];if(0===l(i.parentScopes,t))return void i.acceptOverwrite(e,n,r,a)}-1===n&&(n=this._mainRule.fontStyle),0===r&&(r=this._mainRule.foreground),0===a&&(a=this._mainRule.background),this._rulesWithParentScopes.push(new p(e,t,n,r,a));}else this._mainRule.acceptOverwrite(e,n,r,a);},e}();t.ThemeTrieElement=h;}]);const M={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};class D extends T.exports.Registry{constructor(e){super(e),this._resolver=e,this.themesPath="themes/",this._resolvedThemes={},this._resolvedGrammars={};}getTheme(e){return "string"==typeof e?this._resolvedThemes[e]:e}async loadTheme(e){return "string"==typeof e?(this._resolvedThemes[e]||(this._resolvedThemes[e]=await w(`${this.themesPath}${e}.json`)),this._resolvedThemes[e]):((e=j(e)).name&&(this._resolvedThemes[e.name]=e),e)}async loadThemes(e){return await Promise.all(e.map((e=>this.loadTheme(e))))}getLoadedThemes(){return Object.keys(this._resolvedThemes)}getGrammar(e){return this._resolvedGrammars[e]}async loadLanguage(e){const t=await this.loadGrammar(e.scopeName);this._resolvedGrammars[e.id]=t,e.aliases&&e.aliases.forEach((e=>{this._resolvedGrammars[e]=t;}));}async loadLanguages(e){for(const t of e)this._resolver.addLanguage(t);for(const t of e)await this.loadLanguage(t);}getLoadedLanguages(){return Object.keys(this._resolvedGrammars)}}function G(e){return "string"==typeof e?t.find((t=>{var n;return t.id===e||(null===(n=t.aliases)||void 0===n?void 0:n.includes(e))})):e}async function F(e){var n,a;const{_languages:s,_themes:o}=function(e){var n;let r=t,a=e.themes||[];return (null===(n=e.langs)||void 0===n?void 0:n.length)&&(r=e.langs.map(G)),e.theme&&a.unshift(e.theme),a.length||(a=["nord"]),{_languages:r,_themes:a}}(e),i=new P(async function(){if(!b){let e;if(g)e=u.exports.loadWASM({data:await fetch(k("dist/onig.wasm")).then((e=>e.arrayBuffer()))});else {const t=require("path").join(require.resolve("vscode-oniguruma"),"../onig.wasm"),n=require("fs").readFileSync(t).buffer;e=u.exports.loadWASM(n);}b=e.then((()=>({createOnigScanner:e=>u.exports.createOnigScanner(e),createOnigString:e=>u.exports.createOnigString(e)})));}return b}(),"vscode-oniguruma"),c=new D(i);(null===(n=e.paths)||void 0===n?void 0:n.themes)&&(c.themesPath=e.paths.themes),(null===(a=e.paths)||void 0===a?void 0:a.languages)&&(i.languagesPath=e.paths.languages);const l=(await c.loadThemes(o))[0];let p;await c.loadLanguages(s);const h={"#000001":"var(--shiki-color-text)","#000002":"var(--shiki-color-background)","#000004":"var(--shiki-token-constant)","#000005":"var(--shiki-token-string)","#000006":"var(--shiki-token-comment)","#000007":"var(--shiki-token-keyword)","#000008":"var(--shiki-token-parameter)","#000009":"var(--shiki-token-function)","#000010":"var(--shiki-token-string-expression)","#000011":"var(--shiki-token-punctuation)","#000012":"var(--shiki-token-link)"};function d(e){const t=e?c.getTheme(e):l;if(!t)throw Error(`No theme registration for ${e}`);p&&p.name===t.name||(c.setTheme(t),p=t);const n=c.getColorMap();return "css-variables"===t.name&&function(e,t){e.bg=h[e.bg]||e.bg,e.fg=h[e.fg]||e.fg,t.forEach(((e,n)=>{t[n]=h[e]||e;}));}(t,n),{_theme:t,_colorMap:n}}function f(e,t="text",n,a={includeExplanation:!0}){if(function(e){return !e||["plaintext","txt","text"].includes(e)}(t)){return [...e.split(/\r\n|\r|\n/).map((e=>[{content:e}]))]}const{_grammar:s}=function(e){const t=c.getGrammar(e);if(!t)throw Error(`No language registration for ${e}`);return {_grammar:t}}(t),{_theme:o,_colorMap:i}=d(n);return function(e,t,n,a,s){let o=n.split(/\r\n|\r|\n/),i=T.exports.INITIAL,c=[],u=[];for(let n=0,l=o.length;n<l;n++){let l,p,h,d=o[n];if(""===d){c=[],u.push([]);continue}s.includeExplanation&&(l=a.tokenizeLine(d,i),p=l.tokens,h=0);let f=a.tokenizeLine2(d,i),g=f.tokens.length/2;for(let n=0;n<g;n++){let a=f.tokens[2*n],o=n+1<g?f.tokens[2*n+2]:d.length;if(a===o)continue;let i=f.tokens[2*n+1],u=t[r.getForeground(i)],l=r.getFontStyle(i),m=[];if(s.includeExplanation){let t=0;for(;a+t<o;){let n=p[h],r=d.substring(n.startIndex,n.endIndex);t+=r.length,m.push({content:r,scopes:A(e,n.scopes)}),h++;}}c.push({content:d.substring(a,o),color:u,fontStyle:l,explanation:m});}u.push(c),c=[],i=f.ruleStack;}return u}(o,i,e,s,a)}return {codeToThemedTokens:f,codeToHtml:function(e,t="text",n){let r;r="object"==typeof t?t:{lang:t,theme:n};const a=f(e,r.lang,r.theme,{includeExplanation:!1}),{_theme:s}=d(r.theme);return E(a,{fg:s.fg,bg:s.bg,lineOptions:null==r?void 0:r.lineOptions})},getTheme:e=>d(e)._theme,loadTheme:async function(e){await c.loadTheme(e);},loadLanguage:async function(e){const t=G(e);i.addLanguage(t),await c.loadLanguage(t);},getBackgroundColor:function(e){const{_theme:t}=d(e);return t.bg},getForegroundColor:function(e){const{_theme:t}=d(e);return t.fg},getLoadedThemes:function(){return c.getLoadedThemes()},getLoadedLanguages:function(){return c.getLoadedLanguages()}}}

let highlighterPromise = null;
let highlighter = null;
const newlineRe = /\r\n|\r|\n/;
function highlight({ code, lang, theme, }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (lang === "text") {
            const lines = code ? code.split(newlineRe) : [""];
            return {
                lines: lines.map(line => ({
                    tokens: [{ content: line, props: {} }],
                })),
                lang,
            };
        }
        if (highlighterPromise === null) {
            const isBrowser = typeof window !== "undefined";
            // if we are on the server we load all the languages
            // if we are on the browser just load the first language
            // subsequent calls with different languages will lazy load
            const langs = isBrowser ? [lang] : undefined;
            // TODO add version
            y("https://unpkg.com/shiki/");
            highlighterPromise = F({
                theme: theme,
                langs,
            });
        }
        if (highlighter === null) {
            highlighter = yield highlighterPromise;
        }
        if (missingTheme(highlighter, theme)) {
            yield highlighter.loadTheme(theme);
        }
        if (missingLang(highlighter, lang)) {
            try {
                yield highlighter.loadLanguage(lang);
            }
            catch (e) {
                console.warn("[Code Hike warning]", `${lang} is not a valid language, no syntax highlighting will be applied.`);
                return highlight({ code, lang: "text", theme });
            }
        }
        const tokenizedLines = highlighter.codeToThemedTokens(code, lang, theme.name, {
            includeExplanation: false,
        });
        const lines = tokenizedLines.map(line => ({
            tokens: line.map(token => ({
                content: token.content,
                props: { style: getStyle(token) },
            })),
        }));
        return { lines, lang };
    });
}
function missingTheme(highlighter, theme) {
    return !highlighter
        .getLoadedThemes()
        .some(t => t === theme.name);
}
function missingLang(highlighter, lang) {
    return !highlighter
        .getLoadedLanguages()
        .some(l => l === lang);
}
const FONT_STYLE_TO_CSS = {
    [n.NotSet]: {},
    [n.None]: {},
    [n.Italic]: { fontStyle: "italic" },
    [n.Bold]: { fontWeight: "bold" },
    [n.Underline]: { textDecoration: "underline" },
};
function getStyle(token) {
    const fontStyle = token.fontStyle
        ? FONT_STYLE_TO_CSS[token.fontStyle]
        : {};
    return Object.assign({ color: token.color }, fontStyle);
}

const validKeys = [
    "focus",
    "from",
    ...Object.keys(annotationsMap),
];
function getCommentData(line, lang) {
    const result = bashLikeLangs.includes(lang)
        ? bashLikeComment(line)
        : otherComment(line);
    if (!result) {
        return {};
    }
    const [, key, focusString, data] = result;
    if (!validKeys.includes(key)) {
        return {};
    }
    return {
        key,
        focusString,
        data,
    };
}
function getTextAfter(line, prefix) {
    const firstIndex = line.tokens.findIndex(t => t.content.trim().startsWith(prefix));
    if (firstIndex === -1) {
        return undefined;
    }
    return line.tokens
        .slice(firstIndex)
        .map(t => t.content)
        .join("");
}
const commentRegex = /\/\/\s+(\w+)(\S*)\s*(.*)/;
function otherComment(line) {
    const comment = getTextAfter(line, "//");
    if (!comment) {
        return [];
    }
    const result = commentRegex.exec(comment);
    if (!result) {
        return [];
    }
    return result;
}
const bashLikeLangs = [
    "bash",
    "sh",
    "shell",
    "python",
    "py",
];
const bashLikeCommentRegex = /#\s+(\w+)(\S*)\s*(.*)/;
function bashLikeComment(line) {
    const comment = getTextAfter(line, "#");
    if (!comment) {
        return [];
    }
    const result = bashLikeCommentRegex.exec(comment);
    if (!result) {
        return [];
    }
    return result;
}

function getAnnotationsFromMetastring(options) {
    const annotations = [];
    Object.keys(options).forEach(key => {
        const Component = annotationsMap[key];
        if (Component) {
            annotations === null || annotations === void 0 ? void 0 : annotations.push({ focus: options[key], Component });
        }
    });
    return annotations;
}
function extractAnnotationsFromCode(code) {
    const { lines } = code;
    let lineNumber = 1;
    const annotations = [];
    const focusList = [];
    while (lineNumber <= lines.length) {
        const line = lines[lineNumber - 1];
        const { key, focusString, data } = getCommentData(line, code.lang);
        const Component = annotationsMap[key];
        if (Component) {
            const focus = relativeToAbsolute(focusString, lineNumber);
            lines.splice(lineNumber - 1, 1);
            annotations.push({ Component, focus, data });
        }
        else if (key === "focus") {
            const focus = relativeToAbsolute(focusString, lineNumber);
            lines.splice(lineNumber - 1, 1);
            focusList.push(focus);
        }
        else {
            lineNumber++;
        }
    }
    return [annotations, focusList.join(",")];
}
function extractJSXAnnotations(node, index, parent) {
    const annotations = [];
    const nextIndex = index + 1;
    while (parent.children[nextIndex] &&
        parent.children[nextIndex].type ===
            "mdxJsxFlowElement" &&
        parent.children[nextIndex].name ===
            "CH.Annotation") {
        const jsxAnnotation = parent.children[nextIndex];
        // copy attributes to props
        const props = {};
        jsxAnnotation.attributes.forEach((attr) => {
            props[attr.name] = attr.value;
        });
        const { as, focus } = props, data = __rest(props, ["as", "focus"]);
        data.children = wrapChildren(jsxAnnotation.children || []);
        const Component = annotationsMap[as] || as;
        annotations.push({
            Component,
            focus,
            data: isEmpty$1(data) ? undefined : data,
        });
        parent.children.splice(nextIndex, 1);
    }
    return annotations;
}
function isEmpty$1(obj) {
    return Object.keys(obj).length === 0;
}

function isEditorNode(node, config) {
    if (node.type === "code") {
        const lang = node.lang || "";
        const shouldSkip = config.skipLanguages.includes(lang);
        return !shouldSkip;
    }
    return (node.type === "mdxJsxFlowElement" &&
        node.name === "CH.Code");
}
function mapAnyCodeNode(nodeInfo, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { node } = nodeInfo;
        if (node.type === "code") {
            return mapCode(nodeInfo, config);
        }
        else {
            return mapEditor(nodeInfo, config);
        }
    });
}
function mapCode(nodeInfo, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const file = yield mapFile(nodeInfo, config);
        const props = {
            northPanel: {
                tabs: [file.name],
                active: file.name,
                heightRatio: 1,
            },
            files: [file],
        };
        return props;
    });
}
function mapEditor({ node }, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const [northNodes, southNodes = []] = splitChildren(node, "thematicBreak");
        const northFiles = yield Promise.all(northNodes
            .filter(({ node }) => node.type === "code")
            .map((nodeInfo) => mapFile(nodeInfo, config)));
        const southFiles = yield Promise.all(southNodes
            .filter(({ node }) => node.type === "code")
            .map((nodeInfo) => mapFile(nodeInfo, config)));
        const allFiles = [...northFiles, ...southFiles];
        const northActive = northFiles.find(f => f.active) || northFiles[0];
        const southActive = southFiles.length
            ? southFiles.find(f => f.active) || southFiles[0]
            : null;
        const northLines = northActive.code.lines.length || 1;
        const southLines = (southActive === null || southActive === void 0 ? void 0 : southActive.code.lines.length) || 0;
        const northRatio = southActive
            ? (northLines + 2) / (southLines + northLines + 4)
            : 1;
        const southRatio = 1 - northRatio;
        const props = {
            northPanel: {
                tabs: northFiles.map(x => x.name),
                active: northActive.name,
                heightRatio: northRatio,
            },
            southPanel: southFiles.length
                ? {
                    tabs: southFiles.map(x => x.name),
                    active: southActive.name,
                    heightRatio: southRatio,
                }
                : undefined,
            files: allFiles,
        };
        return props;
    });
}
function mapFile({ node, index, parent }, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { theme } = config;
        const lang = node.lang || "text";
        let code = yield highlight({
            code: node.value,
            lang,
            theme,
        });
        // if the code is a single line with a "from" annotation
        code = yield getCodeFromExternalFileIfNeeded(code, config);
        const [commentAnnotations, commentFocus] = extractAnnotationsFromCode(code);
        const options = parseMetastring(typeof node.meta === "string" ? node.meta : "");
        const metaAnnotations = getAnnotationsFromMetastring(options);
        // const linkAnnotations = extractLinks(
        //   node,
        //   index,
        //   parent,
        //   nodeValue as string
        // )
        const jsxAnnotations = extractJSXAnnotations(node, index, parent);
        const file = Object.assign(Object.assign({}, options), { focus: mergeFocus(options.focus, commentFocus), code, name: options.name || "", annotations: [
                ...metaAnnotations,
                ...commentAnnotations,
                ...jsxAnnotations,
            ] });
        return file;
    });
}
function parseMetastring(metastring) {
    const params = metastring.split(" ");
    const options = {};
    let name = null;
    params.forEach(param => {
        const [key, value] = param.split("=");
        if (value != null) {
            options[key] = value;
        }
        else if (name === null) {
            name = key;
        }
        else {
            options[key] = true;
        }
    });
    return Object.assign({ name: name || "" }, options);
}
function getCodeFromExternalFileIfNeeded(code, config) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        if (((_a = code === null || code === void 0 ? void 0 : code.lines) === null || _a === void 0 ? void 0 : _a.length) != 1) {
            return code;
        }
        const firstLine = code.lines[0];
        const commentData = getCommentData(firstLine, code.lang);
        if (!commentData || commentData.key != "from") {
            return code;
        }
        const fileText = firstLine.tokens
            .map(t => t.content)
            .join("");
        const codepath = commentData.data;
        let fs, path;
        try {
            fs = (yield import('fs')).default;
            path = (yield import('path')).default;
            if (!fs || !fs.readFileSync || !path || !path.resolve) {
                throw new Error("fs or path not found");
            }
        }
        catch (e) {
            e.message = `Code Hike couldn't resolve this annotation:
${fileText}
Looks like node "fs" and "path" modules are not available.`;
            throw e;
        }
        // if we don't know the path of the mdx file:
        if (config.filepath === undefined) {
            throw new Error(`Code Hike couldn't resolve this annotation:
  ${fileText}
  Someone is calling the mdx compile function without setting the path.
  Open an issue on CodeHike's repo for help.`);
        }
        const dir = path.dirname(config.filepath);
        const absoluteCodepath = path.resolve(dir, codepath);
        let nodeValue;
        try {
            nodeValue = fs.readFileSync(absoluteCodepath, "utf8");
        }
        catch (e) {
            e.message = `Code Hike couldn't resolve this annotation:
${fileText}
${absoluteCodepath} doesn't exist.`;
            throw e;
        }
        return yield highlight({
            code: nodeValue,
            lang: code.lang,
            theme: config.theme,
        });
    });
}

function transformCodes(tree, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (node, index, parent) => __awaiter(this, void 0, void 0, function* () {
            if (node.name === "CH.Code") {
                yield transformCode({ node, index, parent }, config);
            }
        }));
        yield visitAsync(tree, "code", (node, index, parent) => __awaiter(this, void 0, void 0, function* () {
            // here we check if we should skip it because of the language:
            if (isEditorNode(node, config)) {
                yield transformCode({ node, index, parent }, config);
            }
        }));
    });
}
function transformCode(nodeInfo, config) {
    return __awaiter(this, void 0, void 0, function* () {
        toJSX(nodeInfo.node, {
            name: "CH.Code",
            props: yield mapAnyCodeNode(nodeInfo, config),
            appendProps: true,
            addConfigProp: true,
        });
    });
}

function transformSections(tree, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (sectionNode) => __awaiter(this, void 0, void 0, function* () {
            if (sectionNode.name === "CH.Section") {
                yield transformSection(sectionNode, config);
            }
        }));
    });
}
function transformSection(node, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let props;
        yield visitAsync(node, ["mdxJsxFlowElement", "code"], (editorNode, index, parent) => __awaiter(this, void 0, void 0, function* () {
            if (isEditorNode(editorNode, config)) {
                props = yield mapAnyCodeNode({ node: editorNode, index, parent }, config);
                toJSX(editorNode, {
                    name: "CH.SectionCode",
                    appendProps: true,
                    props: {},
                });
            }
        }));
        node.data = { editorStep: props };
        transformLinks(node);
        if (props) {
            toJSX(node, {
                name: "CH.Section",
                props: props,
                addConfigProp: true,
                appendProps: true,
            });
        }
        else {
            toJSX(node, { name: "div", props: {} });
        }
    });
}
function transformLinks(tree) {
    visit(tree, "link", (linkNode) => {
        const url = decodeURI(linkNode["url"]);
        if (url.startsWith("focus://")) {
            const [firstPart, secondPart] = decodeURI(url)
                .substr("focus://".length)
                .split("#");
            const hasFile = Boolean(secondPart);
            const props = hasFile
                ? { file: firstPart, focus: secondPart, id: url }
                : { focus: firstPart, id: url };
            toJSX(linkNode, {
                type: "mdxJsxTextElement",
                name: "CH.SectionLink",
                props,
            });
        }
    });
}

// extend steps with info from previous steps
/**
 * Extends `extraStep` with info from `baseStep`.
 *
 * @param baseStep it could be the header step or the previous step
 * @param step the step to be extended
 * @param filter if it is defined, show only the files in the array.
 *
 */
function reduceStep(baseStep, step, filter) {
    let files = reduceFiles(baseStep.files, step.files);
    const newNorthPanel = reducePanel(baseStep.northPanel, step.northPanel, step.southPanel);
    const newSouthPanel = reducePanel(baseStep.southPanel, step.southPanel, step.northPanel);
    if (filter) {
        newNorthPanel.tabs = newNorthPanel.tabs.filter(filename => filter.includes(filename));
        if (newSouthPanel) {
            newNorthPanel.tabs = newNorthPanel.tabs.filter(filename => filter.includes(filename));
        }
    }
    return Object.assign(Object.assign(Object.assign({}, baseStep), step), { files: files, northPanel: newNorthPanel, southPanel: newSouthPanel });
}
function reducePanel(oldPanel, newPanel, otherNewPanel) {
    var _a, _b;
    if (!newPanel) {
        return newPanel;
    }
    const oldTabsStillThere = ((_a = oldPanel === null || oldPanel === void 0 ? void 0 : oldPanel.tabs) === null || _a === void 0 ? void 0 : _a.filter(name => { var _a; return !((_a = otherNewPanel === null || otherNewPanel === void 0 ? void 0 : otherNewPanel.tabs) === null || _a === void 0 ? void 0 : _a.includes(name)); })) || [];
    const realNewTabs = ((_b = newPanel === null || newPanel === void 0 ? void 0 : newPanel.tabs) === null || _b === void 0 ? void 0 : _b.filter(name => { var _a; return !((_a = oldPanel === null || oldPanel === void 0 ? void 0 : oldPanel.tabs) === null || _a === void 0 ? void 0 : _a.includes(name)); })) || [];
    return Object.assign(Object.assign(Object.assign({}, oldPanel), newPanel), { tabs: [...oldTabsStillThere, ...realNewTabs] });
}
function reduceFiles(oldFiles, newFiles) {
    const filesMap = {};
    oldFiles.forEach(f => (filesMap[f.name] = f));
    newFiles.forEach(newFile => {
        const prevFile = filesMap[newFile.name];
        if (!prevFile) {
            filesMap[newFile.name] = newFile;
            return;
        }
        // if the file is in both arrays, merge the content
        // but if the new file is empty, keep the old content
        const { code } = newFile, rest = __rest(newFile, ["code"]);
        if (isEmpty(code)) {
            filesMap[newFile.name] = Object.assign(Object.assign({}, prevFile), rest);
        }
        else {
            filesMap[newFile.name] = newFile;
        }
    });
    // return a new array following the original order:
    // first the old files, then the new ones
    const result = [];
    oldFiles.forEach(f => {
        result.push(filesMap[f.name]);
        delete filesMap[f.name];
    });
    newFiles.forEach(f => filesMap[f.name] && result.push(filesMap[f.name]));
    return result;
}
function isEmpty(code) {
    const anyContent = code.lines.some(l => l.tokens.some(t => t.content.trim() !== ""));
    return !anyContent;
}

function getPresetConfig(attributes) {
    return __awaiter(this, void 0, void 0, function* () {
        // todo add cache
        const presetAttribute = attributes === null || attributes === void 0 ? void 0 : attributes.find((attr) => attr.name === "preset");
        if (!presetAttribute)
            return undefined;
        const url = presetAttribute.value;
        const prefix = "https://codesandbox.io/s/";
        const csbid = url.slice(prefix.length);
        const configUrl = `https://codesandbox.io/api/v1/sandboxes/${csbid}/sandpack`;
        const { default: fetch } = yield import('node-fetch');
        const res = yield fetch(configUrl);
        return yield res.json();
    });
}
function transformPreviews(tree) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (node) => __awaiter(this, void 0, void 0, function* () {
            if (node.name === "CH.Preview") {
                yield transformPreview(node);
            }
        }));
    });
}
function transformPreview(node) {
    return __awaiter(this, void 0, void 0, function* () {
        toJSX(node, {
            props: {},
            appendProps: true,
            addConfigProp: true,
        });
    });
}

// extract step info
function extractStepsInfo(parent, config, merge) {
    return __awaiter(this, void 0, void 0, function* () {
        const steps = [];
        const presetConfig = yield getPresetConfig(parent.attributes);
        let stepIndex = 0;
        const children = parent.children || [];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.type === "thematicBreak") {
                stepIndex++;
                continue;
            }
            steps[stepIndex] = steps[stepIndex] || { children: [] };
            const step = steps[stepIndex];
            if (!step.editorStep && isEditorNode(child, config)) {
                const editorStep = yield mapAnyCodeNode({ node: child, parent, index: i }, config);
                const filter = getFilterFromEditorNode(child);
                if (stepIndex === 0) {
                    // for the header props, keep it as it is
                    step.editorStep = editorStep;
                }
                else {
                    // for the rest, merge the editor step with the header step or the prev step
                    const baseStep = merge === "merge steps with header"
                        ? steps[0].editorStep
                        : previousEditorStep(steps, stepIndex);
                    step.editorStep = reduceStep(baseStep, editorStep, filter);
                }
                step.children.push({
                    type: "mdxJsxFlowElement",
                    name: "CH.CodeSlot",
                });
            }
            else if (child.type === "mdxJsxFlowElement" &&
                child.name === "CH.Preview" &&
                // only add the preview if we have a preview in step 0
                (stepIndex === 0 ||
                    steps[0].previewStep != null ||
                    // or there is a global sandpack preset
                    presetConfig)) {
                step.previewStep = child;
                step.children.push({
                    type: "mdxJsxFlowElement",
                    name: "CH.PreviewSlot",
                });
            }
            else {
                step.children.push(child);
            }
        }
        parent.children = steps.map(step => {
            return {
                type: "mdxJsxFlowElement",
                children: step.children,
                data: { editorStep: step.editorStep },
            };
        });
        const hasPreviewSteps = steps[0].previewStep !== undefined || presetConfig;
        // if there is a CH.Preview in the first step or a preset config
        // build the previewStep list
        if (hasPreviewSteps) {
            const previewSteps = steps.map(step => step.previewStep);
            // fill empties with base step
            previewSteps.forEach((previewStep, i) => {
                if (!previewStep) {
                    if (presetConfig) {
                        // we fill the hole with a placeholder
                        previewSteps[i] = { type: "mdxJsxFlowElement" };
                    }
                    else {
                        previewSteps[i] =
                            merge === "merge steps with header"
                                ? previewSteps[0]
                                : previewSteps[i - 1];
                    }
                }
            });
            parent.children = parent.children.concat(previewSteps);
        }
        // fill editor steps holes
        const editorSteps = steps.map(step => step.editorStep);
        editorSteps.forEach((editorStep, i) => {
            if (!editorStep) {
                editorSteps[i] =
                    merge === "merge steps with header"
                        ? editorSteps[0]
                        : editorSteps[i - 1];
            }
        });
        return {
            editorSteps,
            hasPreviewSteps,
            presetConfig,
        };
    });
}
function previousEditorStep(steps, index) {
    if (index === 0) {
        throw new Error("The first step should have some code");
    }
    return (steps[index - 1].editorStep ||
        previousEditorStep(steps, index - 1));
}
/**
 * Extracts the `show` prop from <CH.Code show={["foo.js", "bar.html"]} />
 */
function getFilterFromEditorNode(node) {
    var _a, _b, _c;
    const value = (_c = (_b = (_a = node.attributes) === null || _a === void 0 ? void 0 : _a.find(a => a.name === "show")) === null || _b === void 0 ? void 0 : _b.value) === null || _c === void 0 ? void 0 : _c.value;
    if (value) {
        return JSON.parse(value);
    }
    else {
        return undefined;
    }
}

function transformSpotlights(tree, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (node) => __awaiter(this, void 0, void 0, function* () {
            if (node.name === "CH.Spotlight") {
                yield transformSpotlight(node, config);
            }
        }));
    });
}
function transformSpotlight(node, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { editorSteps, hasPreviewSteps, presetConfig } = yield extractStepsInfo(node, config, "merge steps with header");
        toJSX(node, {
            props: {
                editorSteps: editorSteps,
                presetConfig,
                hasPreviewSteps,
            },
            appendProps: true,
            addConfigProp: true,
        });
    });
}

function transformScrollycodings(tree, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (node) => __awaiter(this, void 0, void 0, function* () {
            if (node.name === "CH.Scrollycoding") {
                yield transformScrollycoding(node, config);
            }
        }));
    });
}
function transformScrollycoding(node, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { editorSteps, hasPreviewSteps, presetConfig } = yield extractStepsInfo(node, config, "merge step with previous");
        transformLinks(node);
        toJSX(node, {
            props: {
                editorSteps: editorSteps,
                presetConfig,
                hasPreviewSteps,
            },
            appendProps: true,
            addConfigProp: true,
        });
    });
}

function transformSlideshows(tree, config) {
    return __awaiter(this, void 0, void 0, function* () {
        yield visitAsync(tree, "mdxJsxFlowElement", (node) => __awaiter(this, void 0, void 0, function* () {
            if (node.name === "CH.Slideshow") {
                yield transformSlideshow(node, config);
            }
        }));
    });
}
function transformSlideshow(node, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { editorSteps, hasPreviewSteps, presetConfig } = yield extractStepsInfo(node, config, "merge step with previous");
        toJSX(node, {
            props: {
                editorSteps: editorSteps,
                presetConfig,
                hasPreviewSteps,
            },
            appendProps: true,
            addConfigProp: true,
        });
    });
}

function transformInlineCodes(tree, { theme }) {
    return __awaiter(this, void 0, void 0, function* () {
        // transform *`foo`* to <CH.InlineCode>foo</CH.InlineCode>
        visit(tree, "emphasis", (node) => {
            if (node.children &&
                node.children.length === 1 &&
                node.children[0].type === "inlineCode") {
                node.type = "mdxJsxTextElement";
                node.name = "CH.InlineCode";
                node.children = [
                    { type: "text", value: node.children[0].value },
                ];
            }
        });
        yield visitAsync(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (node.name === "CH.InlineCode") {
                const inlinedCode = node.children[0].value;
                const lang = (_a = node.attributes) === null || _a === void 0 ? void 0 : _a.lang;
                toJSX(node, {
                    props: {
                        code: yield getCode(tree, node, inlinedCode, lang, theme),
                    },
                    appendProps: true,
                    addConfigProp: true,
                });
            }
        }));
    });
}
function getCode(tree, node, inlinedCode, lang, theme) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        const ancestors = getAncestors(tree, node);
        const sectionNode = ancestors.find(n => { var _a; return (_a = n.data) === null || _a === void 0 ? void 0 : _a.editorStep; });
        // if node isn't inside a section-like parent, use provided lang or "jsx"
        if (!sectionNode) {
            return yield highlight({
                code: inlinedCode,
                lang: lang || "jsx",
                theme,
            });
        }
        const editorStep = (_a = sectionNode === null || sectionNode === void 0 ? void 0 : sectionNode.data) === null || _a === void 0 ? void 0 : _a.editorStep;
        // if the same code is present in the editor step, use it
        const existingCode = getExistingCode(editorStep.files, inlinedCode);
        if (existingCode) {
            return existingCode;
        }
        // or else, try to guess the language from somewhere
        const activeFile = ((_b = editorStep.files) === null || _b === void 0 ? void 0 : _b.find(f => { var _a; return f.name === ((_a = editorStep.northPanel) === null || _a === void 0 ? void 0 : _a.active); })) || editorStep.files[0];
        const activeLang = (_c = activeFile === null || activeFile === void 0 ? void 0 : activeFile.code) === null || _c === void 0 ? void 0 : _c.lang;
        return yield highlight({
            code: inlinedCode,
            lang: lang || activeLang || "jsx",
            theme,
        });
    });
}
function getAncestors(tree, node) {
    let ancestors = [];
    visitParents(tree, node, (node, nodeAncestors) => {
        ancestors = nodeAncestors;
    });
    return ancestors;
}
function getExistingCode(files, inlinedCode) {
    if (!files) {
        return undefined;
    }
    for (const file of files) {
        for (const line of file.code.lines) {
            const lineContent = line.tokens
                .map(t => t.content)
                .join("");
            const index = lineContent.indexOf(inlinedCode);
            if (index !== -1) {
                const tokens = sliceTokens(line, index, inlinedCode.length);
                return { lang: file.code.lang, lines: [{ tokens }] };
            }
        }
    }
    return undefined;
}
/**
 * Slice a line of tokens from a given index to a given length
 * Turns ("[abc][de][fgh]", 2, 4) into "[c][de][f]")
 */
function sliceTokens(line, start, length) {
    const tokens = line.tokens;
    let currentLength = 0;
    let headTokens = [];
    // this for loop remove the unwanted prefix tokens and put the rest in headTokens
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        if (currentLength === start) {
            headTokens = tokens.slice(tokenIndex);
            break;
        }
        if (currentLength + tokens[tokenIndex].content.length >
            start) {
            const newToken = Object.assign(Object.assign({}, tokens[tokenIndex]), { content: tokens[tokenIndex].content.slice(start - currentLength) });
            headTokens = [newToken].concat(tokens.slice(tokenIndex + 1));
            break;
        }
        currentLength += tokens[tokenIndex].content.length;
    }
    // headTokens is now "[c][de][fgh]" (from the example above)
    currentLength = 0;
    // this for loop remove the unwanted suffix tokens from headTokens
    for (let headTokenIndex = 0; headTokenIndex <= headTokens.length; headTokenIndex++) {
        if (currentLength >= length) {
            return headTokens.slice(0, headTokenIndex);
        }
        const currentToken = headTokens[headTokenIndex];
        if (currentLength + currentToken.content.length >
            length) {
            const newToken = Object.assign(Object.assign({}, currentToken), { content: currentToken.content.slice(0, length - currentLength) });
            return headTokens
                .slice(0, headTokenIndex)
                .concat([newToken]);
        }
        currentLength += currentToken.content.length;
    }
    return [];
}

/**
 * Add defaults and normalize config
 */
function addConfigDefaults(config, cwd, filepath) {
    // TODO warn when config looks weird
    return Object.assign(Object.assign({ staticMediaQuery: "not screen, (max-width: 768px)" }, config), { theme: (config === null || config === void 0 ? void 0 : config.theme) || {}, autoImport: (config === null || config === void 0 ? void 0 : config.autoImport) === false ? false : true, skipLanguages: (config === null || config === void 0 ? void 0 : config.skipLanguages) || [], filepath });
}

const transforms = [
    transformPreviews,
    transformScrollycodings,
    transformSpotlights,
    transformSlideshows,
    transformSections,
    transformInlineCodes,
    transformCodes,
];
const attacher = unsafeConfig => {
    return (tree, file) => __awaiter(void 0, void 0, void 0, function* () {
        const config = addConfigDefaults(unsafeConfig, file === null || file === void 0 ? void 0 : file.cwd, (file === null || file === void 0 ? void 0 : file.history)
            ? file.history[file.history.length - 1]
            : undefined);
        try {
            for (const transform of transforms) {
                yield transform(tree, config);
            }
            const usedCodeHikeComponents = getUsedCodeHikeComponentNames(tree);
            if (usedCodeHikeComponents.length > 0) {
                addConfig(tree, config);
                if (config.autoImport) {
                    addSmartImport(tree, usedCodeHikeComponents);
                }
            }
        }
        catch (e) {
            console.error("error running remarkCodeHike", e);
            throw e;
        }
    });
};
/**
 * Returns a the list of component names
 * used inside the tree
 * that looks like `<CH.* />`
 */
function getUsedCodeHikeComponentNames(tree) {
    const usage = [];
    visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node) => {
        if (node.name &&
            node.name.startsWith("CH.") &&
            !usage.includes(node.name)) {
            usage.push(node.name);
        }
    });
    return usage;
}
/**
 * Creates a `chCodeConfig` variable node in the tree
 * so that the components can access the config
 */
function addConfig(tree, config) {
    tree.children.unshift({
        type: "mdxjsEsm",
        value: `export const ${CH_CODE_CONFIG_VAR_NAME} = {}`,
        data: {
            estree: {
                type: "Program",
                body: [
                    {
                        type: "ExportNamedDeclaration",
                        declaration: {
                            type: "VariableDeclaration",
                            declarations: [
                                {
                                    type: "VariableDeclarator",
                                    id: {
                                        type: "Identifier",
                                        name: CH_CODE_CONFIG_VAR_NAME,
                                    },
                                    init: valueToEstree(config),
                                },
                            ],
                            kind: "const",
                        },
                        specifiers: [],
                        source: null,
                    },
                ],
                sourceType: "module",
            },
        },
    });
}
/**
 * Add an import node at the start of the tree
 * importing all the components used
 */
function addSmartImport(tree, componentNames) {
    const specifiers = [
        "annotations",
        ...componentNames.map(name => name.slice("CH.".length)),
    ];
    tree.children.unshift({
        type: "mdxjsEsm",
        value: `export const CH = { ${specifiers.join(", ")} }`,
        data: {
            estree: {
                type: "Program",
                body: [
                    {
                        type: "ExportNamedDeclaration",
                        declaration: {
                            type: "VariableDeclaration",
                            declarations: [
                                {
                                    type: "VariableDeclarator",
                                    id: {
                                        type: "Identifier",
                                        name: "CH",
                                    },
                                    init: {
                                        type: "ObjectExpression",
                                        properties: specifiers.map(specifier => ({
                                            type: "Property",
                                            method: false,
                                            shorthand: true,
                                            computed: false,
                                            key: {
                                                type: "Identifier",
                                                name: specifier,
                                            },
                                            kind: "init",
                                            value: {
                                                type: "Identifier",
                                                name: specifier,
                                            },
                                        })),
                                    },
                                },
                            ],
                            kind: "const",
                        },
                        specifiers: [],
                        source: null,
                    },
                ],
                sourceType: "module",
                comments: [],
            },
        },
    });
    tree.children.unshift({
        type: "mdxjsEsm",
        value: `import { ${specifiers.join(", ")} } from "@xabierlameiro/code-hike/dist/components.cjs.js"`,
        data: {
            estree: {
                type: "Program",
                body: [
                    {
                        type: "ImportDeclaration",
                        specifiers: specifiers.map(specifier => ({
                            type: "ImportSpecifier",
                            imported: {
                                type: "Identifier",
                                name: specifier,
                            },
                            local: {
                                type: "Identifier",
                                name: specifier,
                            },
                        })),
                        source: {
                            type: "Literal",
                            value: "@xabierlameiro/code-hike/dist/components.cjs.js",
                            raw: '"@xabierlameiro/code-hike/dist/components.cjs.js"',
                        },
                    },
                ],
                sourceType: "module",
            },
        },
    });
}

export { highlight, attacher as remarkCodeHike };
