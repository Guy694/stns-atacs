import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const order = loadTs("lib/facility-order.ts");

const sample = [
  { id: 1, name: "รพ.สต.ขอนคลาน", typecode: "รพ.สต." },
  { id: 2, name: "รพ.ควนกาหลง", typecode: "รพ.ชุมชน" },
  { id: 3, name: "สสอ.ละงู", typecode: "สสอ." },
  { id: 4, name: "ศสช.กำแพง", typecode: "ศสช." },
  { id: 5, name: "รพ.สตูล", typecode: "รพ.ทั่วไป" },
  { id: 6, name: "สสจ.สตูล", typecode: "สสจ." },
  { id: 7, name: "สสอ.ควนกาหลง", typecode: "สสอ." },
  { id: 8, name: "สอน.เฉลิมพระเกียรติ", typecode: "สอน." },
  { id: 9, name: "หน่วยไม่ทราบประเภท", typecode: null },
];

test("facilities follow the provincial hierarchy: สสจ. → สสอ. → รพท. → รพช. → รพ.สต. → others", () => {
  const ids = [...order.sortFacilities(sample)].map((f) => f.id);
  assert.deepEqual(ids, [6, 7, 3, 5, 2, 1, 8, 4, 9]);
});

test("the order can be read from the name when typecode is missing", () => {
  assert.equal(order.facilityTypeRank({ name: "สสจ.สตูล" }), order.facilityTypeRank({ name: "x", typecode: "สสจ." }));
  assert.equal(order.facilityTypeRank({ name: "รพ.สต.บ้านควน" }), order.facilityTypeRank({ name: "x", typecode: "รพ.สต." }));
  assert.ok(order.facilityTypeRank({ name: "รพ.สตูล" }) < order.facilityTypeRank({ name: "รพ.สต.บ้านควน" }), "รพ.สตูล is not a รพ.สต.");
});

test("sorting does not mutate the input array", () => {
  const copy = [...sample];
  order.sortFacilities(sample);
  assert.deepEqual(sample, copy);
});

test("group labels used by the searchable select", () => {
  assert.equal(order.facilityGroupLabel({ name: "x", typecode: "รพ.ทั่วไป" }), "โรงพยาบาลทั่วไป");
  assert.equal(order.facilityGroupLabel({ name: "x", typecode: "รพ.สต." }), "รพ.สต.");
  assert.equal(order.facilityGroupLabel({ name: "x", typecode: null }), "อื่น ๆ");
});
