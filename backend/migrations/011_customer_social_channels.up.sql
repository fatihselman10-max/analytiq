-- Extra customer fields for Messe import: social URLs + preferred contact channel
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS website           VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vk                VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram          VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_channel VARCHAR(50)  NOT NULL DEFAULT '';
