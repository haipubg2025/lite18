# Hướng dẫn dành cho AI (Agent Instructions)

Tệp này chứa các quy tắc và hướng dẫn quan trọng mà AI cần tuân thủ tuyệt đối trong dự án này.

## 1. Ngôn ngữ và Giao tiếp
- **Ngôn ngữ:** Luôn luôn giao tiếp và trả lời duy nhất bằng tiếng Việt Nam.
- **Tính minh bạch:** Luôn luôn giải trình chi tiết về những gì vừa thực hiện. "Nói là phải làm", không hứa suông mà không thực thi mã nguồn tương ứng.
- **Sự gắn gọn:** Không lặp lại những vấn đề đã trả lời ở các lượt trước trừ khi có yêu cầu cụ thể.
- **Sự tập trung:** Đọc kỹ yêu cầu mới nhất của người dùng, tránh nhầm lẫn với các ngữ cảnh cũ không còn phù hợp.

## 2. Công nghệ và Mô hình
- **Mô hình AI:** Ghi nhớ và mặc định rằng mô hình mới nhất đang được sử dụng là **Gemini 3.1 Pro**. Tuyệt đối không sử dụng hoặc nhắc đến các mô hình cũ hơn trong câu trả lời.
- **Stack công nghệ:** Tuân thủ cấu trúc của React + Vite + Tailwind CSS + Three.js như hiện tại của dự án.

## 3. Quy tắc Code
- Luôn sử dụng TypeScript với kiểu dữ liệu chặt chẽ.
- Tuân thủ các nguyên tắc thiết kế trong `frontend-design` và `shadcn` (nếu có).
- Đảm bảo mọi thay đổi đều được kiểm tra bằng `lint_applet` hoặc `compile_applet` trước khi hoàn tất.

## 4. Đặc thù dự án (Remix: Matrix Lite v1)
- Dự án là một trò chơi web/giao diện menu tinh tế.
- Chú trọng vào hiệu ứng thị giác (motion/react), chủ đề (theme) và trải nghiệm người dùng mượt mà.

## 5. Hướng dẫn cấu trúc Thinking (Suy luận) Tiêu chuẩn
Khi xử lý yêu cầu, AI luôn luôn sử dụng thẻ `<THINKING_PROCESS>` để bao bọc quá trình suy luận nội bộ theo trình tự 5 bước thiết yếu sau:
1. **Phân tích dữ liệu đầu vào và các yêu cầu:** Đọc kỹ, trích xuất dữ kiện quan trọng từ bối cảnh và mong muốn của người dùng.
2. **Lên danh sách chi tiết các nhiệm vụ:** Chia nhỏ bài toán lớn thành nhiều nhiệm vụ nhỏ, cụ thể để dễ dàng quản lý.
3. **Lên kế hoạch/ý tưởng giải quyết:** Đưa ra phương án giải quyết cụ thể cho từng đầu việc.
4. **Thực thi:** Bắt tay vào làm từng bước công việc (làm code, viết lách, ...).
5. **Kiểm toán (Audit) và đánh giá:** Sau khi hoàn thành, kiểm toán lại kết quả, đánh giá chất lượng cuối cùng hoặc kiểm tra lỗi chính tả một cách cẩn thận.