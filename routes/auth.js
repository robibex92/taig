router.post('/auth/telegram', async (req, res) => {
    const {
      id, first_name, last_name, username, photo_url, hash
    } = req.body;
  
    if (!checkTelegramAuth(req.body, hash)) {
      return res.status(401).json({ error: 'Invalid Telegram auth data' });
    }
  
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
      let user;
  
      if (rows.length > 0) {
        user = rows[0];
  
        // Обновляем только те поля, которые можно
        const updateFields = [];
        const values = [];
        let idx = 1;
  
        // Обновим имя, если пользователь его не редактировал вручную
        if (!user.is_manually_updated) {
          updateFields.push(`first_name = $${idx++}`);
          values.push(first_name || null);
  
          updateFields.push(`last_name = $${idx++}`);
          values.push(last_name || null);
        }
  
        updateFields.push(`username = $${idx++}`);
        values.push(username);
  
        updateFields.push(`avatar_url = $${idx++}`);
        values.push(photo_url);
  
        values.push(id); // для WHERE
  
        if (updateFields.length > 0) {
          await pool.query(`
            UPDATE users SET ${updateFields.join(', ')} WHERE user_id = $${idx}
          `, values);
        }
  
      } else {
        // Новый пользователь
        const result = await pool.query(`
          INSERT INTO users (
            user_id, username, first_name, last_name,
            avatar_url, status, is_manually_updated
          )
          VALUES ($1, $2, $3, $4, $5, 'active', false)
          RETURNING *
        `, [
          id,
          username,
          first_name || null,
          last_name || null,
          photo_url
        ]);
  
        user = result.rows[0];
      }
  
      // Получаем актуальные данные после вставки/обновления
      const { rows: updatedRows } = await pool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [id]
      );
  
      const updatedUser = updatedRows[0];
  
      // Запоминаем в сессии
      req.session.user = {
        id: updatedUser.user_id,
        username: updatedUser.username,
        avatar: updatedUser.avatar_url,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        status: updatedUser.status
      };
  
      res.json(req.session.user);
  
    } catch (err) {
      console.error('Telegram auth error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  