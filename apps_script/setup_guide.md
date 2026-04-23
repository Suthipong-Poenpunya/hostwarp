# 📋 คู่มือการ Setup ระบบหลังบ้าน - EDU The Final Chapter

## ขั้นตอนที่ 1: สร้าง Google Form

1. ไปที่ [Google Forms](https://forms.google.com) แล้วสร้างฟอร์มใหม่
2. ตั้งชื่อฟอร์ม: **"EDU The Final Chapter - แจก Contact"**
3. เพิ่มฟิลด์ตามลำดับนี้ (สำคัญมาก!):

| ลำดับ | ชื่อฟิลด์ | ประเภท | จำเป็น |
|-------|-----------|--------|--------|
| 1 | ชื่อ-นามสกุล | Short answer | ✅ |
| 2 | วิชาเอก | Short answer | ✅ |
| 3 | Instagram Contact (เช่น @username) | Short answer | ✅ |
| 4 | คำคมที่อยากเอาขึ้นจอ | Paragraph | ✅ |
| 5 | แนบรูปภาพ | File upload | ✅ |

> ⚠️ **สำคัญ**: ลำดับฟิลด์ต้องตรงตามนี้! ถ้าสลับลำดับ ต้องแก้ไข `COLS` ใน Code.gs

4. สำหรับฟิลด์ **แนบรูปภาพ**:
   - เลือก "File upload"
   - ✅ Allow only specific file types: Image
   - Maximum number of files: 1
   - Maximum file size: 10 MB

5. กด **Responses** tab → Click ไอคอน **Sheets** → สร้าง Spreadsheet ใหม่

---

## ขั้นตอนที่ 2: ตั้งค่า Spreadsheet

1. เปิด Spreadsheet ที่เชื่อมกับ Form
2. ตรวจสอบว่าคอลัมน์เป็นตามนี้:
   - A: Timestamp
   - B: ชื่อ-นามสกุล
   - C: วิชาเอก
   - D: Instagram Contact
   - E: คำคม
   - F: รูปภาพ (File URL)

> ℹ️ ถ้าคอลัมน์ไม่ตรง ให้แก้ไข `COLS` ใน Code.gs ให้ตรงกัน

---

## ขั้นตอนที่ 3: เพิ่ม Apps Script

1. ใน Spreadsheet กด **Extensions** → **Apps Script**
2. ลบ Code เดิมทั้งหมดใน `Code.gs`
3. Copy Code จากไฟล์ `Code.gs` ในโฟลเดอร์นี้ไปวาง
4. กด **Save** (Ctrl+S)

---

## ขั้นตอนที่ 4: Initialize Sheet

1. ใน Apps Script Editor เลือก function `initializeSheet` จาก dropdown
2. กด **Run** ▶️
3. อนุญาต permissions ที่ขอ (ครั้งแรกจะต้อง authorize)
4. ตรวจสอบ Spreadsheet → ควรมีคอลัมน์ G: Status, H: Display Time เพิ่มขึ้น

---

## ขั้นตอนที่ 5: ตั้ง Trigger สำหรับ Form Submit

1. ใน Apps Script Editor กด ⏰ **Triggers** (เมนูซ้าย)
2. กด **+ Add Trigger**
3. ตั้งค่า:
   - Function: `onFormSubmit`
   - Event source: `From spreadsheet`
   - Event type: `On form submit`
4. กด **Save**

---

## ขั้นตอนที่ 6: Deploy เป็น Web App

1. ใน Apps Script Editor กด **Deploy** → **New deployment**
2. กด ⚙️ → เลือก **Web app**
3. ตั้งค่า:
   - Description: "EDU Contact Display API"
   - Execute as: **Me**
   - Who has access: **Anyone**
4. กด **Deploy**
5. **คัดลอก Web App URL** ที่ได้ → เอาไปใส่ใน Display page

> ⚠️ **สำคัญ**: ทุกครั้งที่แก้ไข Code ต้อง Deploy ใหม่!
> ไปที่ Deploy → Manage deployments → แก้ไข → Version: New version → Deploy

---

## ขั้นตอนที่ 7: ตั้งค่า Google Drive Permissions

รูปภาพที่ผู้ใช้อัปโหลดผ่าน Form จะถูกเก็บใน Google Drive

1. ไปที่ Google Drive
2. หาโฟลเดอร์ที่เก็บไฟล์จาก Form (ปกติชื่อเดียวกับ Form)
3. คลิกขวา → **Share**
4. เปลี่ยนเป็น **Anyone with the link** → **Viewer**
5. กด **Done**

> ℹ️ ขั้นตอนนี้จำเป็นเพื่อให้ Display page แสดงรูปภาพได้

---

## ทดสอบระบบ

### ทดสอบ API
1. เปิด Web App URL ใน Browser
2. ควรเห็น JSON response: `{"success":true,"hasData":false,"message":"Queue is empty"}`
3. ลองกรอก Form → รอสักครู่ → Refresh URL
4. ควรเห็นข้อมูลที่กรอกใน JSON

### ทดสอบ Queue
1. กรอก Form 3 ครั้งติดๆ กัน
2. เปิด Spreadsheet → ดูว่า Status เป็น "pending" ทั้ง 3 แถว
3. เรียก API → ข้อมูลแรกจะเปลี่ยนเป็น "displaying"
4. รอ 15 วินาที → เรียก API อีกครั้ง → ข้อมูลที่สองจะเปลี่ยนเป็น "displaying"

### รีเซ็ตสถานะ
ถ้าต้องการเริ่มแสดงใหม่ทั้งหมด:
1. ใน Apps Script เลือก function `resetAllStatus`
2. กด **Run** ▶️

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|--------|---------|
| API ขึ้น "Sheet not found" | แก้ `CONFIG.SHEET_NAME` ใน Code.gs ให้ตรงกับชื่อ Sheet |
| รูปภาพไม่แสดง | ตรวจสอบ Drive sharing permissions |
| ข้อมูลไม่เข้าคิว | ตรวจว่าตั้ง Trigger `onFormSubmit` แล้ว |
| แก้ Code แล้วไม่มีผล | ต้อง Deploy version ใหม่ทุกครั้ง |
| คอลัมน์ไม่ตรง | เปรียบเทียบลำดับฟิลด์ Form กับ `COLS` ใน Code.gs |
