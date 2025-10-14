-- Проверка статусов пользователей
SELECT 
  status, 
  COUNT(*) as count,
  STRING_AGG(DISTINCT username, ', ') as usernames
FROM users
GROUP BY status
ORDER BY count DESC;
