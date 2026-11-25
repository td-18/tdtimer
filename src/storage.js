// localStorage 读写：失败时静默降级，不让页面崩掉
export const safeLS = {
    get(key) {
        try {
            const v = JSON.parse(localStorage.getItem(key));
            return Array.isArray(v) ? v : [];
        } catch (e) {
            return [];
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    },
};
