"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var readline_1 = require("readline");
var ollama_1 = require("@langchain/ollama");
var dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
var rl = (0, readline_1.createInterface)({
    input: process.stdin,
    output: process.stdout,
});
var chatHistory = [];
function chat() {
    return __awaiter(this, void 0, void 0, function () {
        var userInput, model, result, aiResponse, _a, _b, _c, chunk, e_1_1, error_1;
        var _d, e_1, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log("Welcome to the CLI chat! Type `/new` to start a new chat or `/exit` to quit.");
                    _g.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 19];
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl.question("You: ", resolve);
                        })];
                case 2:
                    userInput = _g.sent();
                    if (userInput.toLowerCase() === "/exit") {
                        console.log("GoodBye!!");
                        rl.close();
                        process.exit(0);
                    }
                    if (userInput.toLowerCase() === "/new") {
                        console.log("Starting a new chat...");
                        chatHistory = [];
                        return [3 /*break*/, 1];
                    }
                    chatHistory.push({ role: "user", content: userInput });
                    _g.label = 3;
                case 3:
                    _g.trys.push([3, 17, , 18]);
                    model = new ollama_1.ChatOllama({
                        model: "llama3.2:latest",
                        baseUrl: "http://127.0.0.1:11434",
                        temperature: 0,
                        maxRetries: 3,
                    });
                    result = model.invoke(userInput);
                    process.stdout.write("AI: ");
                    aiResponse = "";
                    _g.label = 4;
                case 4:
                    _g.trys.push([4, 10, 11, 16]);
                    _a = true;
                    e_1 = void 0;
                    return [4 /*yield*/, result];
                case 5:
                    _b = (__asyncValues.apply(void 0, [(_g.sent()).content]));
                    _g.label = 6;
                case 6: return [4 /*yield*/, _b.next()];
                case 7:
                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 9];
                    _f = _c.value;
                    _a = false;
                    chunk = _f;
                    process.stdout.write(chunk.toString());
                    aiResponse += chunk.toString();
                    _g.label = 8;
                case 8:
                    _a = true;
                    return [3 /*break*/, 6];
                case 9: return [3 /*break*/, 16];
                case 10:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 16];
                case 11:
                    _g.trys.push([11, , 14, 15]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 13];
                    return [4 /*yield*/, _e.call(_b)];
                case 12:
                    _g.sent();
                    _g.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 15: return [7 /*endfinally*/];
                case 16:
                    console.log("\n");
                    chatHistory.push({ role: "assistant", content: aiResponse });
                    return [3 /*break*/, 18];
                case 17:
                    error_1 = _g.sent();
                    console.error("Error: ", error_1.message);
                    return [3 /*break*/, 18];
                case 18: return [3 /*break*/, 1];
                case 19: return [2 /*return*/];
            }
        });
    });
}
chat();
