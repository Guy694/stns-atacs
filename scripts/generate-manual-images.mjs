// Run with: node scripts/generate-manual-images.mjs
// These are workflow illustrations, not screenshots of live user data.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

const output = new URL("../public/manuals/images/", import.meta.url);
mkdirSync(output, { recursive: true });
for (const name of ["roles-and-access", "dashboard-drilldown", "windows-license-decision", "inspection-workflow"]) {
  copyFileSync(new URL(`../docs/manual/images/${name}.svg`, import.meta.url), new URL(`${name}.svg`, output));
}

const workflows = [
  {
    name: "asset-search", title: "ค้นหาให้พบ ก่อนเพิ่มรายการใหม่", subtitle: "รายการทรัพย์สิน → ตัวกรอง → รายละเอียด",
    steps: [
      ["เปิดทะเบียน", "เลือกรายการทรัพย์สิน", "หรือหน่วยงานในความดูแล"],
      ["ค้นหาและกรอง", "ชื่อ · เลขทะเบียน · Serial Number", "เลือกหน่วยงาน ประเภท และสถานะ"],
      ["เปิดรายละเอียด", "ตรวจผู้ครอบครองและสถานที่ติดตั้ง", "ดูข้อมูลจัดซื้อ รูปภาพ และ MA"],
      ["ตรวจประวัติ", "ดูสถานะและข้อมูลล่าสุด", "ใช้ QR Code จากหน้ารายละเอียด"],
    ],
    note: "ไม่พบรายการ? ล้างตัวกรอง แล้วตรวจหน่วยงานของบัญชีก่อนค้นหาอีกครั้ง",
  },
  {
    name: "csv-import", title: "นำเข้า CSV / Excel อย่างถูกต้อง", subtitle: "เตรียมไฟล์ → เลือกหน่วยบริการ → อัปโหลด → ตรวจผล",
    steps: [
      ["ดาวน์โหลดไฟล์ตัวอย่าง", "คงชื่อคอลัมน์ และกรอก asset_name", "บันทึก CSV เป็น UTF-8"],
      ["ตรวจ id และกลุ่มงาน", "เพิ่มใหม่: เว้น id ว่าง", "แก้ไข: ใช้ id จาก Export ของระบบ"],
      ["เลือกหน่วยบริการ", "ใช้ work_group_id ของหน่วยบริการนี้", "เลือกไฟล์แล้วเริ่มนำเข้า"],
      ["อ่านผลเป็น record", "เพิ่มใหม่ + แก้ไข = สำเร็จ", "ข้าม / ไม่สำเร็จ: ตรวจแถวและเหตุผล"],
    ],
    note: "นำเข้าใหม่เฉพาะแถวที่ไม่สำเร็จ เพื่อไม่ให้รายการที่เพิ่มสำเร็จแล้วซ้ำ",
  },
  {
    name: "asset-transfer", title: "โอนย้ายให้ตรงหน่วยงานปลายทาง", subtitle: "ตรวจต้นทางและปลายทางก่อนบันทึกทุกครั้ง",
    steps: [
      ["ค้นหาทรัพย์สิน", "ตรวจชื่อ เลขทะเบียน และต้นทาง", "เลือกโอนย้ายทรัพย์สินนี้"],
      ["เลือกปลายทาง", "เลือกหน่วยงานที่จะรับทรัพย์สิน", "ต้องอยู่ในขอบเขตที่มีสิทธิ์จัดการ"],
      ["ระบุข้อมูลใหม่", "ผู้ครอบครอง · ตำแหน่งติดตั้ง", "อธิบายเหตุผลในการโอนย้าย"],
      ["บันทึกและตรวจสอบ", "เปิดรายละเอียดหลังโอน", "ตรวจหน่วยงานและประวัติใหม่"],
    ],
    note: "ต้องมีสิทธิ์จัดการทั้งต้นทางและปลายทาง หากไม่พบหน่วยงานให้ติดต่อผู้ดูแลระบบ",
  },
  {
    name: "asset-disposal", title: "บันทึกเหตุการณ์และสถานะทรัพย์สิน", subtitle: "จำหน่ายและเหตุผิดปกติ → ดำเนินการ",
    steps: [
      ["ตรวจรายการ", "ชื่อ · เลขทะเบียน · หน่วยงาน", "ตรวจสถานะปัจจุบันก่อนดำเนินการ"],
      ["เลือกเหตุการณ์", "ชำรุด · ระงับการใช้งาน", "จำหน่ายออก · สูญหาย"],
      ["ระบุวันที่และเหตุผล", "เลือกวันที่ดำเนินการ", "กรอกรายละเอียดที่ตรวจสอบได้"],
      ["บันทึกสถานะ", "กดบันทึกการดำเนินการ", "ตรวจสถานะและประวัติล่าสุด"],
    ],
    note: "เลือกตามข้อเท็จจริง และตรวจรายการให้ถูกต้องก่อนยืนยันการเปลี่ยนสถานะ",
  },
  {
    name: "reports-map", title: "อ่านข้อมูลและนำรายงานไปใช้", subtitle: "แผนที่แสดงตำแหน่ง · รายงานแสดงยอดและรายการ",
    steps: [
      ["ดูแผนที่", "เปิดแผนที่ทรัพย์สิน", "เลือกหมุดหรือรายการหน่วยบริการ"],
      ["เลือกมุมมองรายงาน", "ภาพรวม · หน่วยงาน · ประเภท", "ใกล้หมดอายุ MA · ชำรุด / ไม่ใช้งาน"],
      ["ตรวจขอบเขตข้อมูล", "ดูตัวกรองและหน่วยงาน", "ตรวจยอดก่อนส่งออก"],
      ["ส่งออก CSV", "ใช้ปุ่ม Export CSV ที่แสดง", "เปิดไฟล์ด้วย UTF-8 เพื่ออ่านภาษาไทย"],
    ],
    note: "ข้อมูลที่เห็นขึ้นอยู่กับสิทธิ์ของบัญชีและขอบเขตที่เลือก",
  },
  {
    name: "agent-setup", title: "เตรียมเครื่องให้พร้อมสำหรับ ATACS Agent", subtitle: "เจ้าหน้าที่หน่วยงาน → ดาวน์โหลด Agent",
    steps: [
      ["ตรวจบัญชี", "บัญชีต้องผูกหน่วยงานถูกต้อง", "เลือกกลุ่มงานตามที่ระบบกำหนด"],
      ["ดาวน์โหลด", "ใช้ตัวติดตั้งจากหน้าของระบบ", "อ่านคำแนะนำก่อนเรียกใช้"],
      ["ติดตั้งบนเครื่อง", "Windows: สิทธิ์ Administrator", "Linux: สิทธิ์ sudo / root"],
      ["ตรวจการติดต่อ", "ดูข้อมูลเครื่องและเวลาติดต่อล่าสุด", "หากไม่พบ ให้ตรวจเครือข่ายและ Agent"],
    ],
    note: "Enrollment Token และ Install Key เป็นข้อมูลลับ ไม่ใส่ในภาพหน้าจอที่เผยแพร่",
  },
  {
    name: "administration", title: "ดูแลผู้ใช้และตรวจสอบการทำงาน", subtitle: "จัดการตามหน้าที่ และทดสอบหลังปรับสิทธิ์",
    steps: [
      ["ตรวจคำขอผู้ใช้", "ชื่อ · อีเมล · ตำแหน่ง · หน่วยงาน", "ตรวจข้อมูลก่อนอนุมัติบัญชี"],
      ["กำหนดขอบเขต", "เลือกบทบาทและหน่วยงาน", "ให้สิทธิ์ตามงานที่รับผิดชอบ"],
      ["ตั้งค่าการทำงาน", "Permission Matrix: ความสามารถ", "การแสดงเมนู: รายการใน sidebar"],
      ["ติดตามประวัติ", "กรองผู้ใช้ การกระทำ และวันที่", "ตรวจว่าใครเปลี่ยนข้อมูลอะไร"],
    ],
    note: "ซ่อนเมนูไม่ได้เปลี่ยนสิทธิ์ ควรตรวจทั้งบทบาท สิทธิ์ และหน่วยงานของบัญชี",
  },
  {
    name: "troubleshooting", title: "ตรวจปัญหาทีละจุด", subtitle: "เก็บข้อความผิดพลาดไว้ เพื่อให้แก้ไขได้ตรงจุด",
    steps: [
      ["อ่านสิ่งที่ระบบแจ้ง", "จดข้อความผิดพลาดและชื่อหน้า", "ตรวจว่าบันทึกสำเร็จแล้วหรือยัง"],
      ["ตรวจบัญชี", "รออนุมัติ? หมดเวลาใช้งาน?", "ตรวจบทบาท สิทธิ์ และหน่วยงาน"],
      ["ตรวจข้อมูล", "ล้างตัวกรอง / กรอกช่องบังคับ", "CSV: ตรวจ id และ work_group_id"],
      ["ติดต่อผู้ดูแล", "แจ้งเวลา ขั้นตอน และข้อความผิดพลาด", "แนบภาพโดยปกปิดข้อมูลลับ"],
    ],
    note: "อย่าเพิ่มหรือนำเข้าซ้ำก่อนตรวจว่ารายการเดิมบันทึกสำเร็จหรือไม่",
  },
];

const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
for (const workflow of workflows) {
  const boxes = workflow.steps.map(([title, line1, line2], index) => {
    const x = index % 2 === 0 ? 80 : 850;
    const y = index < 2 ? 245 : 520;
    return `<g transform="translate(${x} ${y})">
      <rect width="670" height="205" rx="14" fill="#ffffff" stroke="#b8d3c3"/>
      <circle cx="52" cy="53" r="25" fill="#dcfce7"/>
      <text x="52" y="62" text-anchor="middle" fill="#14532d" font-size="26" font-weight="700">${index + 1}</text>
      <text x="95" y="64" fill="#113127" font-size="32" font-weight="600">${escape(title)}</text>
      <text x="36" y="121" fill="#344a40" font-size="27">${escape(line1)}</text>
      <text x="36" y="165" fill="#344a40" font-size="27">${escape(line2)}</text>
    </g>`;
  }).join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
  <title id="title">${escape(workflow.title)}</title>
  <desc id="desc">${escape(workflow.steps.map((step, index) => `${index + 1}. ${step.join(" — ")}`).join("; "))}</desc>
  <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke="#15803d" stroke-width="2"/></marker></defs>
  <rect width="1600" height="900" fill="#f5faf7"/>
  <g font-family="Tahoma,system-ui,sans-serif">
    <text x="80" y="68" fill="#4f6b60" font-size="22">ATACS · ภาพอธิบายขั้นตอน</text>
    <text x="80" y="135" fill="#113127" font-size="44" font-weight="700">${escape(workflow.title)}</text>
    <text x="80" y="187" fill="#4f6b60" font-size="27">${escape(workflow.subtitle)}</text>
    ${boxes}
    <path d="M765 347H830" fill="none" stroke="#15803d" stroke-width="3" marker-end="url(#arrow)"/>
    <path d="M1185 462V482H415V505" fill="none" stroke="#15803d" stroke-width="3" marker-end="url(#arrow)"/>
    <path d="M765 622H830" fill="none" stroke="#15803d" stroke-width="3" marker-end="url(#arrow)"/>
    <path d="M80 784H1520" stroke="#b8d3c3"/>
    <text x="80" y="836" fill="#14532d" font-size="26">${escape(workflow.note)}</text>
  </g>
</svg>
`;
  writeFileSync(new URL(`${workflow.name}.svg`, output), svg, "utf8");
}
console.log(`Generated ${workflows.length} workflow illustrations and copied 4 existing illustrations.`);
