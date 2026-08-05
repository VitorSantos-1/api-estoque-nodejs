CREATE DATABASE IF NOT EXISTS products_db;
USE products_db;

-- Produtos
CREATE TABLE IF NOT EXISTS products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  barcode VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(120),
  category VARCHAR(120),
  unit VARCHAR(32),

  -- Campos extras (não quebram seu front, só adicionam capacidade)
  sku VARCHAR(64) NULL,
  image_url TEXT NULL,
  min_stock INT DEFAULT 0,

  price DECIMAL(10,2) DEFAULT 0.00,
  cost DECIMAL(10,2) DEFAULT 0.00,
  quantity INT DEFAULT 0,

  specs JSON NULL,

  status ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_barcode (barcode),
  UNIQUE KEY uq_sku (sku),

  INDEX idx_products_name (name),
  INDEX idx_products_category (category),
  INDEX idx_products_brand (brand),
  INDEX idx_products_status (status),
  INDEX idx_products_quantity (quantity)
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  status ENUM('ATIVO','INATIVO') DEFAULT 'ATIVO',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Configurações (1 linha fixa)
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  low_stock_alert INT DEFAULT 10,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings (id, company_name, email, phone, address, low_stock_alert)
VALUES (1, 'Minha Empresa', 'contato@empresa.com', '', '', 10)
ON DUPLICATE KEY UPDATE id=id;

-- Pedidos (Opcional)
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  total DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);