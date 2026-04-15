INSERT INTO "customers" (
  "userId", "firstName", "lastName", "phoneNumber", "address",
  "zipCode", "town", "email", "userName", "password"
)
VALUES
('CUST001', 'Luca', 'Meier', '+41 79 102 34 51', 'Alpenstrasse 4', '8001', 'Zürich', 'dj.nikolic@hotmail.com', 'luca-meier', '$2b$12$w7XmZpGsfmK1XTUjjw2qCu4tU.yRLcKLfHvD9Pnq3lzkrtBWGteSq'),
('CUST002', 'Nina', 'Keller', '+41 78 215 67 82', 'Bahnhofstrasse 12', '3001', 'Bern', 'dj.nikolic@hotmail.com', 'nina-keller', '$2b$12$Ud/2dILK7k9N4Vm.iU4Dzu6/2J1MsN8tE.22LZ21KUx3Pfzzkaegu'),
('CUST003', 'Jonas', 'Schmid', '+41 76 318 45 29', 'Lindenstrasse 7', '6003', 'Luzern', 'dj.nikolic@hotmail.com', 'jonas-schmid', '$2b$12$cabkbkvUH/AHM6eL8AxyhOMscmrFcZvTw.nOVdi0teM.u0PPf04k2'),
('CUST004', 'Sara', 'Weber', '+41 79 427 81 63', 'Rosenweg 15', '9000', 'St. Gallen', 'dj.nikolic@hotmail.com', 'sara-weber', '$2b$12$yaSmHjKk/GQLDmrpcZEO4.en.lSYcwX6JYqsdmxCI1w3QSHssMm1q'),
('CUST005', 'Leon', 'Fischer', '+41 78 536 24 70', 'Kirchgasse 9', '4051', 'Basel', 'dj.nikolic@hotmail.com', 'leon-fischer', '$2b$12$DChHEhVgQxK4k3b8SHW7l./4xI88vrACPBhenVpbed9aC5OAChmPm'),
('CUST006', 'Emma', 'Brunner', '+41 76 641 93 18', 'Seestrasse 21', '7000', 'Chur', 'dj.nikolic@hotmail.com', 'emma-brunner', '$2b$12$DKsfYPfHtuB5O3Sk4GG.lu7wnuUnzvJVBOozEIpA.AMpGHaDttHzG'),
('CUST007', 'Noah', 'Baumann', '+41 79 754 18 46', 'Dorfstrasse 6', '6300', 'Zug', 'dj.nikolic@hotmail.com', 'noah-baumann', '$2b$12$5fLPFtdWxlUTUzOGun32uuD0M.cfcXNU/MGn3zujNbXpQdDvzTll6'),
('CUST008', 'Mia', 'Frei', '+41 78 863 52 91', 'Gartenstrasse 18', '8400', 'Winterthur', 'dj.nikolic@hotmail.com', 'mia-frei', '$2b$12$CwWEa5q4/hJXkF1HZmV4pusQ8duVK7tbfdRAkmyako7Wn7DMMNw8m'),
('CUST009', 'Tim', 'Graf', '+41 76 974 26 35', 'Wiesenstrasse 3', '4600', 'Olten', 'dj.nikolic@hotmail.com', 'tim-graf', '$2b$12$zxlnNzkGDWJXtT3iNoXa6ufRT67wybE30gFz0QQlDAnHIssEoeDbK'),
('CUST010', 'Lara', 'Vogel', '+41 79 185 74 62', 'Schulstrasse 11', '2502', 'Biel', 'dj.nikolic@hotmail.com', 'lara-vogel', '$2b$12$a5FKQFuRTxUmaiK2vSGI4ul4Q5dswExBLQJrK61aea647LFC7vCKC'),
('CUST011', 'David', 'Huber', '+41 78 296 43 17', 'Talstrasse 8', '1003', 'Lausanne', 'dj.nikolic@hotmail.com', 'david-huber', '$2b$12$6Xg2gEFa9YcVPEXin9DHTeqYrtem.AzXLTjM82gZvivLsSOOoacx6'),
('CUST012', 'Lea', 'Ammann', '+41 76 307 65 84', 'Feldstrasse 14', '1201', 'Genève', 'dj.nikolic@hotmail.com', 'lea-ammann', '$2b$12$dBTNLxxZqV24Y6XODve1NOTco22pD0lmYxFj1yuaIazANx4YMfwne'),
('CUST013', 'Simon', 'Widmer', '+41 79 418 29 53', 'Bergstrasse 5', '6900', 'Lugano', 'dj.nikolic@hotmail.com', 'simon-widmer', '$2b$12$1W8.dfXsmI51a/qCAo3R2.mpDx.h8V2LLFrenpCRz0D5y6U89.fPq'),
('CUST014', 'Alina', 'Marti', '+41 78 529 87 20', 'Quellenstrasse 17', '5000', 'Aarau', 'dj.nikolic@hotmail.com', 'alina-marti', '$2b$12$OosaWNCe39vaUqkAsnuBKudahMsB/P6mw7m9ZJa16U88n.zb5UgSu'),
('CUST015', 'Jan', 'Kuhn', '+41 76 630 14 97', 'Sonnenstrasse 10', '8500', 'Frauenfeld', 'dj.nikolic@hotmail.com', 'jan-kuhn', '$2b$12$GHvp7IP2480X03Tbau2eqO81MAKuBTAJETf0KINZjzj8TiCXJLgNG')
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "products" (
  "productId", "name", "price", "currency", "updatedAt"
)
VALUES
('PROD005', 'Boat on Quiet Water', 2133, 'CHF', CURRENT_TIMESTAMP),
('PROD008', 'Pine Cone Monochrome', 3945, 'CHF', CURRENT_TIMESTAMP),
('PROD009', 'Garden Fence Scene', 2700, 'CHF', CURRENT_TIMESTAMP),
('PROD002', 'Desk Workspace Flatlay', 6632, 'CHF', CURRENT_TIMESTAMP),
('PROD001', 'Forest Lake View', 5142, 'CHF', CURRENT_TIMESTAMP),
('PROD003', 'Vintage Coffee Mug', 3409, 'CHF', CURRENT_TIMESTAMP),
('PROD004', 'Cat Nose Closeup', 561, 'CHF', CURRENT_TIMESTAMP),
('PROD007', 'Foggy Tree Avenue', 2728, 'CHF', CURRENT_TIMESTAMP),
('PROD006', 'Modern Office Desk', 1647, 'CHF', CURRENT_TIMESTAMP),
('PROD010', 'Beach Panorama', 6214, 'CHF', CURRENT_TIMESTAMP)
ON CONFLICT ("productId") DO NOTHING;