// META: global=jsshell
// META: script=/wasm/jsapi/wasm-constants.js
// META: script=/wasm/jsapi/wasm-module-builder.js

let emptyModuleBinary;
setup(() => {
  emptyModuleBinary = new WasmModuleBuilder().toBuffer();
});

function assert_ModuleExportDescriptor(export_, expected) {
  assert_equals(Object.getPrototypeOf(export_), Object.prototype, "Prototype");
  assert_true(Object.isExtensible(export_), "isExtensible");

  const name = Object.getOwnPropertyDescriptor(export_, "name");
  assert_true(name.writable, "name: writable");
  assert_true(name.enumerable, "name: enumerable");
  assert_true(name.configurable, "name: configurable");
  assert_equals(name.value, expected.name);

  const kind = Object.getOwnPropertyDescriptor(export_, "kind");
  assert_true(kind.writable, "kind: writable");
  assert_true(kind.enumerable, "kind: enumerable");
  assert_true(kind.configurable, "kind: configurable");
  assert_equals(kind.value, expected.kind);
}

function assert_exports(exports, expected) {
  assert_true(Array.isArray(exports), "Should be array");
  assert_equals(Object.getPrototypeOf(exports), Array.prototype, "Prototype");
  assert_true(Object.isExtensible(exports), "isExtensible");

  assert_equals(exports.length, expected.length);
  for (let i = 0; i < expected.length; ++i) {
    assert_ModuleExportDescriptor(exports[i], expected[i]);
  }
}

test(() => {
  assert_throws(new TypeError(), () => WebAssembly.Module.exports());
}, "Missing arguments");

test(() => {
  const invalidArguments = [
    undefined,
    null,
    true,
    "",
    Symbol(),
    1,
    {},
    WebAssembly.Module,
    WebAssembly.Module.prototype,
  ];
  for (const argument of invalidArguments) {
    assert_throws(new TypeError(), () => WebAssembly.Module.exports(argument),
                  `exports(${format_value(argument)})`);
  }
}, "Non-Module arguments");

test(() => {
  const module = new WebAssembly.Module(emptyModuleBinary);
  const fn = WebAssembly.Module.exports;
  const thisValues = [
    undefined,
    null,
    true,
    "",
    Symbol(),
    1,
    {},
    WebAssembly.Module,
    WebAssembly.Module.prototype,
  ];
  for (const thisValue of thisValues) {
    assert_array_equals(fn.call(thisValue, module), []);
  }
}, "Branding");

test(() => {
  const module = new WebAssembly.Module(emptyModuleBinary);
  const exports = WebAssembly.Module.exports(module);
  assert_exports(exports, []);
}, "Empty module");

test(() => {
  const module = new WebAssembly.Module(emptyModuleBinary);
  assert_not_equals(WebAssembly.Module.exports(module), WebAssembly.Module.exports(module));
}, "Empty module: array caching");

test(() => {
  const builder = new WasmModuleBuilder();

  builder
    .addFunction("fn", kSig_v_v)
    .addBody([
        kExprEnd
    ])
    .exportFunc();
  builder
    .addFunction("fn2", kSig_v_v)
    .addBody([
        kExprEnd
    ])
    .exportFunc();

  builder.setFunctionTableLength(1);
  builder.addExportOfKind("table", kExternalTable, 0);

  builder.addGlobal(kWasmI32, true)
    .exportAs("global")
    .init = 7;
  builder.addGlobal(kWasmF64, true)
    .exportAs("global2")
    .init = 1.2;

  builder.addMemory(0, 256, true);

  const buffer = builder.toBuffer()
  const module = new WebAssembly.Module(buffer);
  const exports = WebAssembly.Module.exports(module);
  const expected = [
    { "kind": "function", "name": "fn" },
    { "kind": "function", "name": "fn2" },
    { "kind": "table", "name": "table" },
    { "kind": "global", "name": "global" },
    { "kind": "global", "name": "global2" },
    { "kind": "memory", "name": "memory" },
  ];
  assert_exports(exports, expected);
}, "exports");

test(() => {
  const module = new WebAssembly.Module(emptyModuleBinary);
  const exports = WebAssembly.Module.exports(module, {});
  assert_exports(exports, []);
}, "Stray argument");

test(() => {
  const exportingModuleLongIdentityFn = (() => {
      const builder = new WasmModuleBuilder();

      builder
          .addFunction('id', kSig_l_l)
          .addBody([ kExprGetLocal, 0 ])
          .exportFunc();

      return builder.toBuffer();
  })();

  const module = new WebAssembly.Module(exportingModuleLongIdentityFn);
  const instance = new WebAssembly.Instance(module);

  const value = 2n ** 63n;
  const output = instance.exports.id(value);
  assert_equals(output, - (2n ** 63n));
  assertThrows(() => instance.exports.id(5), TypeError);
  assert_equals(instance.exports.id("5"), 5n);
}, "WebAssembly longs are converted to JavaScript as if by ToBigInt64 in exported functions");
