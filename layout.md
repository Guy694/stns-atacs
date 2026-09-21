คุณคือ Senior UI/UX Designer และ Senior Frontend Developer
เชี่ยวชาญการออกแบบ Modern SaaS Dashboard ด้วย Next.js, React,
TypeScript, Tailwind CSS และ shadcn/ui

จงออกแบบ Dashboard Web Application โดยใช้แนวทางการออกแบบดังนี้

DESIGN DIRECTION
สร้าง UI สไตล์ Modern SaaS Dashboard / Soft Corporate Dashboard
มีความสะอาด Minimal, Premium, Professional และทันสมัย
เหมาะสำหรับระบบองค์กรและหน่วยงานภาครัฐ

Mood:
- Clean
- Modern
- Professional
- Soft Corporate
- Light SaaS UI
- Airy layout
- Friendly enterprise interface
- ใช้พื้นที่ว่างอย่างเหมาะสม
- หลีกเลี่ยง UI ที่ดูแน่นหรือสีฉูดฉาด

==================================================
COLOR SYSTEM
==================================================

ใช้ชุดสีหลักดังนี้

Primary Blue:
#1687D9

Primary Dark:
#13599A

Primary Light:
#E7F3FC

Hero Banner Gradient:
linear-gradient(
  120deg,
  #15548F 0%,
  #1689DB 100%
)

Application Background:
#F4F8FC

Card Background:
#FFFFFF

Border:
#E2EAF2

Main Heading:
#142332

Body Text:
#5F6F7F

Secondary Text:
#8997A5

Success / Mint:
#38B99A

Light Mint:
#E7F8F3

Purple Accent:
#8B63D9

Purple Background:
#F2ECFC

Warning:
#F5A524

Danger:
#E85D5D

==================================================
APPLICATION LAYOUT
==================================================

ออกแบบ Dashboard แบบ Desktop-first

โครงสร้างหลักประกอบด้วย

1. TOP NAVBAR

ความสูงประมาณ 70px
พื้นหลังสีขาว
border-bottom สี #E2EAF2

ด้านซ้ายแสดง:
- Logo
- ชื่อระบบ

ด้านขวาแสดง:
- Language selector
- Notification button
- User Avatar
- User Name
- Dropdown
- Primary Action Button

Primary button ใช้สี #1687D9
ตัวอักษรสีขาว
border-radius 10-12px

==================================================

2. LEFT SIDEBAR

ความกว้างประมาณ 250-270px

พื้นหลังสีขาว
มีเส้น border สี #E2EAF2
border-radius ประมาณ 18px

Sidebar menu ให้มี icon + label

ตัวอย่างเมนู

Dashboard
Assets
Asset Registration
Asset Categories
Maintenance
Repair Requests
Reports
Notifications
Users
Settings

Active Menu:

background:
#E7F3FC

text:
#176C9E

icon:
#1687D9

border-radius:
10px

มี indicator เล็กๆ ด้านขวาของเมนู Active

Spacing ระหว่าง menu ประมาณ 8-12px

==================================================

3. MAIN CONTENT

Background:
#F4F8FC

padding:
24-32px

max-width:
responsive full width

==================================================

4. HERO / WELCOME BANNER

สร้าง Hero Banner ขนาดใหญ่ด้านบน

ใช้ gradient:

#15548F → #1689DB

border-radius:
18-20px

ความสูงประมาณ:
230-260px

ด้านซ้ายประกอบด้วย

small eyebrow text

ตัวอย่าง:
ASSET MANAGEMENT SYSTEM

Main Heading:

"ยินดีต้อนรับสู่ระบบทะเบียนครุภัณฑ์"

Subtitle:

"จัดการทะเบียนทรัพย์สิน การตรวจสอบ การบำรุงรักษา
และติดตามสถานะครุภัณฑ์ได้จากระบบเดียว"

Action Buttons:

Primary White Button:
"+ เพิ่มครุภัณฑ์"

Secondary Transparent Button:
"ดูทะเบียนทั้งหมด →"

ด้านขวาของ Banner
สร้าง Decorative Dashboard Illustration

เช่น
- floating card
- asset document
- inventory icon
- QR Code card
- computer equipment card

ให้เป็น abstract UI illustration
ไม่ต้องใช้ภาพคน

ใช้ opacity และ soft shadow
เพื่อให้ดูเหมือน floating card

==================================================

5. PAGE SECTION HEADER

ด้านล่าง Hero Banner

ใช้ Eyebrow Label สี #3183A8

เช่น

ASSET OVERVIEW

Heading ขนาดใหญ่

"ภาพรวมครุภัณฑ์"

Subtitle:

"ข้อมูลสถานะครุภัณฑ์ทั้งหมดภายในสำนักงาน"

==================================================

6. STATISTIC CARDS

สร้าง Grid 4 Columns

Card Style:

background:
white

border:
1px solid #E2EAF2

border-radius:
16px

padding:
22px

shadow:
very subtle

แต่ละ Card มี

Icon Box
Title
Large Number
Description
Small arrow icon ด้านขวาบน

ตัวอย่าง Card

ครุภัณฑ์ทั้งหมด
1,284
รายการ

ใช้งานปกติ
1,102
85.8%

รอซ่อม
42
รายการ

จำหน่ายแล้ว
140
รายการ

Icon Background สามารถใช้

Light Blue
#E6F4FC

Light Mint
#E7F8F3

Light Purple
#F2ECFC

Light Orange
#FFF3E1

Icon ให้ใช้ Lucide Icons

==================================================

7. SECONDARY INFORMATION CARDS

ด้านล่าง Statistic Cards
สร้าง Grid 2 Columns

แต่ละ Card ขนาดใหญ่

Card 1

หัวข้อ:
"ครุภัณฑ์ล่าสุด"

แสดงรายการครุภัณฑ์ล่าสุด
ประมาณ 5 รายการ

Card 2

หัวข้อ:
"รายการรอดำเนินการ"

แสดง

รอตรวจสอบ
รอซ่อม
รอจำหน่าย
รอโอน

แต่ละรายการใช้ Status Badge

==================================================
TYPOGRAPHY
==================================================

ภาษาไทยใช้

Noto Sans Thai

หรือ

IBM Plex Sans Thai

ภาษาอังกฤษใช้

Inter

Font Weight:

Heading:
600-700

Body:
400

Menu:
500

Number:
600-700

Heading ใหญ่แต่ไม่หนาจนเกินไป

ใช้ Line Height ที่อ่านง่าย

==================================================
UI COMPONENT STYLE
==================================================

ทุก Component ต้องใช้แนวทางเดียวกัน

Border Radius:
12px - 18px

Buttons:
10px - 12px

Cards:
16px - 18px

Inputs:
10px

ใช้ border มากกว่า heavy shadow

หลีกเลี่ยง Drop Shadow หนา

ใช้ Soft Shadow:

0 4px 20px rgba(15, 60, 100, 0.05)

Hover Card:

transform: translateY(-2px)

เพิ่ม border สีฟ้าอ่อน

transition:
200ms ease

==================================================
ICONS
==================================================

ใช้ Lucide React

icon stroke:
1.5 - 2

หลีกเลี่ยง icon แบบ solid

==================================================
RESPONSIVE DESIGN
==================================================

Desktop:
Sidebar + Main Content

Tablet:
Sidebar Collapsible

Mobile:
Sidebar เปลี่ยนเป็น Drawer

Statistic Cards:

Desktop:
4 columns

Tablet:
2 columns

Mobile:
1 column

==================================================
UX REQUIREMENTS
==================================================

UI ต้องดูสะอาด
อ่านง่าย
มี visual hierarchy ชัดเจน

อย่าใส่ข้อมูลมากเกินไปในแต่ละ Card

เน้น whitespace

สีฟ้าใช้สำหรับ

Primary Action
Active State
Important Navigation

อย่าใช้สีน้ำเงินทุกพื้นที่

ใช้ White Card และ Light Background
เพื่อช่วยสร้าง Contrast

==================================================
TECH STACK
==================================================

Next.js 16+
TypeScript
Tailwind CSS
shadcn/ui
Lucide React

ใช้ Component Architecture ที่สามารถ reuse ได้

/components
  /layout
  /dashboard
  /ui

สร้าง reusable components เช่น

AppSidebar
TopNavbar
HeroBanner
StatCard
SectionHeader
StatusBadge
RecentAssetList
PendingTaskCard

ต้องรองรับ Dark Mode architecture
แต่ Default UI เป็น Light Mode

==================================================
FINAL RESULT
==================================================

ผลลัพธ์ต้องให้ความรู้สึกคล้าย Premium SaaS Application

Modern
Clean
Soft
Professional
Government Enterprise Ready

ไม่ให้ดูเหมือน Admin Template ราคาถูก

เน้นรายละเอียด spacing, typography,
border, hover state และ visual hierarchy

UI ต้องดูดีบนจอ 1920x1080 และ 1440x900