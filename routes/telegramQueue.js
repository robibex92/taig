export const queueTelegramTask = (task) => {
  setTimeout(async () => {
    try {
      await task();
    } catch (err) {
      console.error("Telegram task error:", err);
    }
  }, 0);
};