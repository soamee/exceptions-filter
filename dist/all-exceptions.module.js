"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const all_exceptions_filter_1 = require("./all-exceptions.filter");
const filter_config_interface_1 = require("./interfaces/filter-config.interface");
let AllExceptionsModule = AllExceptionsModule_1 = class AllExceptionsModule {
    static forRoot(config) {
        return {
            module: AllExceptionsModule_1,
            global: true,
            providers: [
                {
                    provide: filter_config_interface_1.EXCEPTIONS_FILTER_CONFIG,
                    useValue: config,
                },
                {
                    provide: core_1.APP_FILTER,
                    useClass: all_exceptions_filter_1.AllExceptionsFilter,
                },
            ],
        };
    }
    static forRootAsync(options) {
        return {
            module: AllExceptionsModule_1,
            global: true,
            imports: options.imports || [],
            providers: [
                {
                    provide: filter_config_interface_1.EXCEPTIONS_FILTER_CONFIG,
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
                {
                    provide: core_1.APP_FILTER,
                    useClass: all_exceptions_filter_1.AllExceptionsFilter,
                },
            ],
        };
    }
};
exports.AllExceptionsModule = AllExceptionsModule;
exports.AllExceptionsModule = AllExceptionsModule = AllExceptionsModule_1 = __decorate([
    (0, common_1.Module)({})
], AllExceptionsModule);
