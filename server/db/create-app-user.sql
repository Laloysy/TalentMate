-- ============================================
-- 业务数据库账户（方案 §17 P1「数据库账户」）
--
-- 背景：当前 Docker Compose 里应用直接用 MySQL root 账户连库。
-- 一旦应用被攻破或 SQL 注入成功，攻击者就拿到了整个实例的最高权限。
-- 这里创建一个只对 voice_calendar 库有增删改查权限的业务账户。
--
-- 使用方式（在 MySQL 容器内执行一次即可）：
--   docker compose exec mysql mysql -uroot -p < server/db/create-app-user.sql
--
-- 然后修改 .env：
--   DB_USER=talentmate_app
--   DB_PASSWORD=<换成你自己的强密码>
-- 并重建/重启 server 容器。
--
-- ⚠️ 请务必先替换下面的占位密码再执行，不要直接使用示例值。
-- ============================================

-- 业务账户：只允许连接 voice_calendar 库
CREATE USER IF NOT EXISTS 'talentmate_app'@'%'
  IDENTIFIED BY 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 只授予该库的数据操作权限：
--   不使用 ALL PRIVILEGES，不授予 CREATE / DROP / ALTER / GRANT 等结构或权限类操作。
--   应用启动时 services/schema.js 会做「缺列则补列」的 ALTER TABLE，
--   因此需要 ALTER；如果后续不需要自动补列，可以去掉这一项进一步收紧。
GRANT SELECT, INSERT, UPDATE, DELETE, ALTER, INDEX
  ON voice_calendar.* TO 'talentmate_app'@'%';

FLUSH PRIVILEGES;

-- 校验：应只看到 voice_calendar 库上的授权
SHOW GRANTS FOR 'talentmate_app'@'%';
