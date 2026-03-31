INSERT INTO customers (
  user_id, first_name, last_name, phone_number, address,
  zip_code, town, email, user_name, password
)
VALUES
('CUST001', 'Luca', 'Meier', '+41 79 102 34 51', 'Alpenstrasse 4', '8001', 'Zürich', 'dj.nikolic@hotmail.com', 'luca-meier', 'cust001'),
('CUST002', 'Nina', 'Keller', '+41 78 215 67 82', 'Bahnhofstrasse 12', '3001', 'Bern', 'dj.nikolic@hotmail.com', 'nina-keller', 'cust002'),
('CUST003', 'Jonas', 'Schmid', '+41 76 318 45 29', 'Lindenstrasse 7', '6003', 'Luzern', 'dj.nikolic@hotmail.com', 'jonas-schmid', 'cust003'),
('CUST004', 'Sara', 'Weber', '+41 79 427 81 63', 'Rosenweg 15', '9000', 'St. Gallen', 'dj.nikolic@hotmail.com', 'sara-weber', 'cust004'),
('CUST005', 'Leon', 'Fischer', '+41 78 536 24 70', 'Kirchgasse 9', '4051', 'Basel', 'dj.nikolic@hotmail.com', 'leon-fischer', 'cust005'),
('CUST006', 'Emma', 'Brunner', '+41 76 641 93 18', 'Seestrasse 21', '7000', 'Chur', 'dj.nikolic@hotmail.com', 'emma-brunner', 'cust006'),
('CUST007', 'Noah', 'Baumann', '+41 79 754 18 46', 'Dorfstrasse 6', '6300', 'Zug', 'dj.nikolic@hotmail.com', 'noah-baumann', 'cust007'),
('CUST008', 'Mia', 'Frei', '+41 78 863 52 91', 'Gartenstrasse 18', '8400', 'Winterthur', 'dj.nikolic@hotmail.com', 'mia-frei', 'cust008'),
('CUST009', 'Tim', 'Graf', '+41 76 974 26 35', 'Wiesenstrasse 3', '4600', 'Olten', 'dj.nikolic@hotmail.com', 'tim-graf', 'cust009'),
('CUST010', 'Lara', 'Vogel', '+41 79 185 74 62', 'Schulstrasse 11', '2502', 'Biel', 'dj.nikolic@hotmail.com', 'lara-vogel', 'cust010'),
('CUST011', 'David', 'Huber', '+41 78 296 43 17', 'Talstrasse 8', '1003', 'Lausanne', 'dj.nikolic@hotmail.com', 'david-huber', 'cust011'),
('CUST012', 'Lea', 'Ammann', '+41 76 307 65 84', 'Feldstrasse 14', '1201', 'Genève', 'dj.nikolic@hotmail.com', 'lea-ammann', 'cust012'),
('CUST013', 'Simon', 'Widmer', '+41 79 418 29 53', 'Bergstrasse 5', '6900', 'Lugano', 'dj.nikolic@hotmail.com', 'simon-widmer', 'cust013'),
('CUST014', 'Alina', 'Marti', '+41 78 529 87 20', 'Quellenstrasse 17', '5000', 'Aarau', 'dj.nikolic@hotmail.com', 'alina-marti', 'cust014'),
('CUST015', 'Jan', 'Kuhn', '+41 76 630 14 97', 'Sonnenstrasse 10', '8500', 'Frauenfeld', 'dj.nikolic@hotmail.com', 'jan-kuhn', 'cust015')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO products (
  product_id, name, price, currency, amount, updated_at
)
VALUES
('PROD005', 'Boat on Quiet Water', 2133, 'CHF', 138, CURRENT_TIMESTAMP),
('PROD008', 'Pine Cone Monochrome', 3945, 'CHF', 115, CURRENT_TIMESTAMP),
('PROD009', 'Garden Fence Scene', 2700, 'CHF', 171, CURRENT_TIMESTAMP),
('PROD002', 'Desk Workspace Flatlay', 6632, 'CHF', 113, CURRENT_TIMESTAMP),
('PROD001', 'Forest Lake View', 5142, 'CHF', 146, CURRENT_TIMESTAMP),
('PROD003', 'Vintage Coffee Mug', 3409, 'CHF', 130, CURRENT_TIMESTAMP),
('PROD004', 'Cat Nose Closeup', 561, 'CHF', 182, CURRENT_TIMESTAMP),
('PROD007', 'Foggy Tree Avenue', 2728, 'CHF', 149, CURRENT_TIMESTAMP),
('PROD006', 'Modern Office Desk', 1647, 'CHF', 185, CURRENT_TIMESTAMP),
('PROD010', 'Beach Panorama', 6214, 'CHF', 170, CURRENT_TIMESTAMP)
ON CONFLICT (product_id) DO NOTHING;