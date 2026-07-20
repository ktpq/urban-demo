# Urban Demo

## รายละเอียดโปรเจกต์

**Urban Demo** เป็นเว็บแอปพลิเคชันสาธิตที่พัฒนาขึ้นโดยประยุกต์ใช้ **ArcGIS Urban API**

วัตถุประสงค์หลักของโปรเจกต์นี้คือ:
- ศึกษาและทดสอบข้อจำกัดของ ArcGIS Urban API
- ลดความซับซ้อนของหน้าต่างการทำงาน แทนการเข้าใช้งานผ่านหน้าเว็บไซต์หลักโดยตรง
- ให้ผู้ใช้งานทั่วไปสามารถเข้าถึงและใช้งานระบบได้อย่างสะดวก ไม่ซับซ้อนจนเกินไป

---

## ภาพตัวอย่างการทำงาน

<!-- เว้นพื้นที่สำหรับแทรกรูปภาพ -->
<img width="1898" height="983" alt="image" src="https://github.com/user-attachments/assets/ced05b47-0251-4c1d-9bab-cc9dde483769" />


---

## ขั้นตอนการติดตั้งและการตั้งค่าระบบ

คำแนะนำด้านล่างนี้สำหรับขั้นตอนการเตรียมความพร้อมและการเรียกใช้งานโปรเจกต์บนเครื่องคอมพิวเตอร์ของคุณ

### 1️⃣ การติดตั้ง (Installation)

เปิด Command Line หรือ Terminal แล้ว clone โปรเจกต์ (Private Repository):

```bash
git clone https://github.com/ktpq/urban-demo
```

จากนั้นเข้าไปยังโฟลเดอร์ของโปรเจกต์ และติดตั้งแพ็กเกจ/ไลบรารีที่จำเป็นทั้งหมด:

```bash
npm install
```

---

### 2️⃣ เปลี่ยน API Key เป็นอันล่าสุด

> ⚠️ **หมายเหตุ:** API Key จะหมดอายุทุก 2 ชั่วโมง กรุณาอัปเดตให้เป็นค่าล่าสุดก่อนใช้งาน

<img width="515" height="399" alt="image" src="https://github.com/user-attachments/assets/7c58f7d2-a208-4406-8cd0-1ce169ad25d8" />

<img width="1590" height="208" alt="image" src="https://github.com/user-attachments/assets/0f91ffc7-f641-4e58-902a-366a8d3f4c37" />

<img width="1690" height="425" alt="image" src="https://github.com/user-attachments/assets/c1310216-1c62-4bd4-8697-43df51717aa1" />

<img width="1259" height="492" alt="image" src="https://github.com/user-attachments/assets/57333dd6-71c2-44d0-b79c-f1ab8f5502ea" />

นำ API Key ที่ได้ไปใส่แทนตัวเก่าในไฟล์ `environment.development.ts`:

<img width="1373" height="304" alt="image" src="https://github.com/user-attachments/assets/3a654723-a9ea-4b39-a83c-a21c7b3b9ffe" />



---

### 3️⃣ การรัน Project

```bash
npm run start

<!--  เปิดหน้าเว็บที่ localhost:4200  -->
```

---

## ฟังก์ชั่นการทำงาน
- 1
- 1
- 1



