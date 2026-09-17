(async () => {
    try {
        await import('./src/index.js');
    } catch (err) {
        console.error("Lỗi khi khởi động server:", err);
    }
})();
