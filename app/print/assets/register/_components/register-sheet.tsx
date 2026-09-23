import type { CheckboxOption, RegisterSheet } from "@/lib/register-sheet";

/**
 * ทะเบียนคุมทรัพย์สิน 1 แผ่น = ครุภัณฑ์ 1 รายการ (A4 แนวนอน)
 * ใช้ CSS ธรรมดา (ไม่ใช้ utility class) เพื่อให้หน้าพิมพ์คงที่และตรวจสอบหน้าตาได้นอกระบบ
 */
export const REGISTER_SHEET_CSS = `
  .reg-sheet { width: 297mm; height: 210mm; padding: 7mm 8mm; background: #fff; color: #000; box-sizing: border-box;
    font-size: 9pt; line-height: 1.25; display: flex; flex-direction: column; }
  .reg-sheet table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .reg-sheet th, .reg-sheet td { border: 0.4mm solid #0033cc; padding: 1mm 1.5mm; vertical-align: middle; word-wrap: break-word; }
  .reg-title { text-align: center; font-weight: 700; font-size: 11pt; }
  .reg-org { text-align: right; font-weight: 700; padding-right: 4mm !important; }
  .reg-label { font-weight: 700; font-size: 8.5pt; }
  .reg-empty { height: 4mm; }
  .reg-box { display: inline-flex; align-items: center; gap: 1.5mm; margin-right: 6mm; white-space: nowrap; }
  .reg-box span.mark { display: inline-flex; align-items: center; justify-content: center; width: 3.4mm; height: 3.4mm;
    border: 0.35mm solid #0033cc; font-size: 8pt; line-height: 1; }
  .reg-ledger { margin-top: 2mm; flex: 1; }
  .reg-ledger th { text-align: center; font-weight: 700; height: 14mm; }
  .reg-ledger td { height: 7mm; font-size: 9pt; }
  .reg-num { text-align: right; font-variant-numeric: tabular-nums; }
  .reg-center { text-align: center; }
  .reg-foot { margin-top: 2mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #444; }
`;

function Boxes({ options }: { options: CheckboxOption[] }) {
  return (
    <>
      {options.map((option) => (
        <span key={option.label} className="reg-box">
          <span className="mark">{option.checked ? "✓" : ""}</span>
          {option.label}
          {option.note ? ` ${option.note}` : option.label === "อื่น ๆ" ? " ...................................." : ""}
        </span>
      ))}
    </>
  );
}

export function RegisterSheetView({ sheet, printedBy, printedAt }: { sheet: RegisterSheet; printedBy?: string; printedAt?: string }) {
  return (
    <section className="reg-sheet">
      <table>
        <colgroup>
          {["13%", "17%", "7%", "15%", "12%", "14%", "8%", "14%"].map((width, index) => <col key={index} style={{ width }} />)}
        </colgroup>
        <tbody>
          <tr><td className="reg-title" colSpan={8}>ทะเบียนคุมทรัพย์สิน</td></tr>
          <tr><td className="reg-org" colSpan={8}>ส่วนราชการ&nbsp;&nbsp;{sheet.ministry}</td></tr>
          <tr><td className="reg-org" colSpan={8}>หน่วยงาน&nbsp;&nbsp;{sheet.facilityName}</td></tr>
          <tr>
            <td className="reg-label">ประเภท</td>
            <td>{sheet.assetClassLabel}</td>
            <td className="reg-label">รหัส</td>
            <td>{sheet.assetNumber}</td>
            <td className="reg-label">ลักษณะ/คุณสมบัติ</td>
            <td>{sheet.specification}</td>
            <td className="reg-label">รุ่น/แบบ</td>
            <td>{sheet.model}</td>
          </tr>
          <tr>
            <td className="reg-label">สถานที่ตั้ง/หน่วยงานผู้รับผิดชอบ</td>
            <td colSpan={3}>{sheet.location}</td>
            <td className="reg-label">ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค</td>
            <td colSpan={3}>{sheet.vendorName}</td>
          </tr>
          <tr>
            <td className="reg-label">ที่อยู่</td>
            <td colSpan={3} />
            <td className="reg-label">โทรศัพท์</td>
            <td colSpan={3} />
          </tr>
          <tr>
            <td className="reg-label">ประเภทเงิน</td>
            <td colSpan={7}><Boxes options={sheet.fundingOptions} /></td>
          </tr>
          <tr>
            <td className="reg-label">วิธีการได้มา</td>
            <td colSpan={7}><Boxes options={sheet.methodOptions} /></td>
          </tr>
        </tbody>
      </table>

      <table className="reg-ledger">
        <colgroup>
          {["7.8%", "7.1%", "20.6%", "5.7%", "7.8%", "7.8%", "5%", "5.7%", "8.5%", "8.5%", "8.5%", "7%"].map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>วัน เดือน ปี</th>
            <th>ที่เอกสาร</th>
            <th>รายการ</th>
            <th>จำนวน<br />(หน่วย)</th>
            <th>ราคาต่อ<br />หน่วย/ชุด/กลุ่ม</th>
            <th>มูลค่ารวม</th>
            <th>อายุ<br />ใช้งาน</th>
            <th>อัตรา<br />ค่าเสื่อมราคา</th>
            <th>ค่าเสื่อมราคา<br />ประจำปี</th>
            <th>ค่าเสื่อม<br />ราคาสะสม</th>
            <th>มูลค่าสุทธิ</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, index) => (
            <tr key={index}>
              <td className="reg-center">{row.date}</td>
              <td className="reg-center">{row.documentNo}</td>
              <td>{row.detail}</td>
              <td className="reg-center">{row.quantity}</td>
              <td className="reg-num">{row.unitPrice}</td>
              <td className="reg-num">{row.total}</td>
              <td className="reg-center">{row.life}</td>
              <td className="reg-center">{row.rate}</td>
              <td className="reg-num">{row.depreciation}</td>
              <td className="reg-num">{row.accumulated}</td>
              <td className="reg-num">{row.bookValue}</td>
              <td className="reg-center">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="reg-foot">
        <span>{sheet.startNote}</span>
        <span>{printedBy ? `พิมพ์จากระบบ ATACS โดย ${printedBy}${printedAt ? ` · ${printedAt}` : ""}` : ""}</span>
      </div>
    </section>
  );
}
