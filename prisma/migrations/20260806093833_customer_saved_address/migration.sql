-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressCountry" TEXT NOT NULL DEFAULT 'CZ',
ADD COLUMN     "addressPostalCode" TEXT,
ADD COLUMN     "addressStreet" TEXT;
