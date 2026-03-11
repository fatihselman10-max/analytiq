-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_type VARCHAR(50) NOT NULL, -- marketplace, ecommerce, advertising
    credentials TEXT NOT NULL, -- encrypted JSON
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Products table (unified product catalog)
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(255),
    cost_price DECIMAL(12, 2) DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_user_sku ON products(user_id, sku);
CREATE INDEX idx_products_user_barcode ON products(user_id, barcode);

-- Orders table (unified orders from all platforms)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id BIGINT NOT NULL REFERENCES integrations(id),
    platform VARCHAR(50) NOT NULL,
    platform_order_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'TRY',
    total_amount DECIMAL(12, 2) NOT NULL,
    subtotal_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    net_profit DECIMAL(12, 2) DEFAULT 0,
    city VARCHAR(255),
    order_date TIMESTAMPTZ NOT NULL,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, platform_order_id)
);

CREATE INDEX idx_orders_user_date ON orders(user_id, order_date DESC);
CREATE INDEX idx_orders_user_platform ON orders(user_id, platform);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255),
    sku VARCHAR(255),
    barcode VARCHAR(255),
    product_name VARCHAR(500),
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) DEFAULT 0,
    commission DECIMAL(12, 2) DEFAULT 0
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);

-- Ad spend table (data from Meta, Google, TikTok)
CREATE TABLE IF NOT EXISTS ad_spend (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id BIGINT NOT NULL REFERENCES integrations(id),
    platform VARCHAR(50) NOT NULL,
    campaign_id VARCHAR(255),
    campaign_name VARCHAR(500),
    ad_set_id VARCHAR(255),
    ad_set_name VARCHAR(500),
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    spend DECIMAL(12, 2) DEFAULT 0,
    conversions BIGINT DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    roas DECIMAL(10, 4) DEFAULT 0,
    cpc DECIMAL(10, 4) DEFAULT 0,
    cpm DECIMAL(10, 4) DEFAULT 0,
    ctr DECIMAL(10, 4) DEFAULT 0,
    date DATE NOT NULL,
    currency VARCHAR(10) DEFAULT 'TRY',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, campaign_id, ad_set_id, date)
);

CREATE INDEX idx_ad_spend_user_date ON ad_spend(user_id, date DESC);
CREATE INDEX idx_ad_spend_user_platform ON ad_spend(user_id, platform);

-- Daily summary table (pre-aggregated metrics)
CREATE TABLE IF NOT EXISTS daily_summaries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_revenue DECIMAL(14, 2) DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_ad_spend DECIMAL(14, 2) DEFAULT 0,
    total_profit DECIMAL(14, 2) DEFAULT 0,
    aov DECIMAL(12, 2) DEFAULT 0,
    roas DECIMAL(10, 4) DEFAULT 0,
    conversion_rate DECIMAL(10, 4) DEFAULT 0,
    platform VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date, platform)
);

CREATE INDEX idx_daily_summaries_user_date ON daily_summaries(user_id, date DESC);

-- Attribution table (links ads to orders)
CREATE TABLE IF NOT EXISTS attributions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id),
    ad_spend_id BIGINT REFERENCES ad_spend(id),
    campaign_id VARCHAR(255),
    ad_platform VARCHAR(50),
    click_id VARCHAR(255),
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    model VARCHAR(50) DEFAULT 'last_click',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attributions_user ON attributions(user_id);
CREATE INDEX idx_attributions_order ON attributions(order_id);
