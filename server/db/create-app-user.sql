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

-- 只授予该库所需的数据与结构操作权限。
-- 不授予 DROP / GRANT OPTION / CREATE USER / SUPER / FILE，也不授权 mysql 系统库。
--
-- 各项权限的用途：
--   SELECT/INSERT/UPDATE/DELETE —— 正常业务读写
--   ALTER                       —— services/schema.js 启动时补列
--   CREATE / REFERENCES         —— services/schema.js 启动时
--                                  `CREATE TABLE IF NOT EXISTS`（含外键）
--                                  缺这两项会看到：
--                                  [Schema] Failed to ensure schema: CREATE command denied
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, REFERENCES, INDEX, ALTER
  ON voice_calendar.* TO 'talentmate_app'@'%';

FLUSH PRIVILEGES;

-- 校验：应只看到 voice_calendar 库上的授权
SHOW GRANTS FOR 'talentmate_app'@'%';

-- 回滚（如需）：
--   DROP USER 'talentmate_app'@'%';
-- 并把 .env 的 DB_USER / DB_PASSWORD 改回原来的账户。
