const { ethers } = require("hardhat");

async function main() {
  const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const dcms = await ethers.getContractAt("DCMS", address);

  const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  // Check user's bookings
  try {
    const myBookings = await dcms.getMyBookings();
    console.log("User bookings:", myBookings.length);
    for (const b of myBookings) {
      console.log(`  Booking #${b.id}: resource ${b.resourceId}, ${b.startTime} -> ${b.endTime}, cancelled: ${b.cancelled}`);
    }
  } catch (e) {
    console.log("getMyBookings error:", e.message);
  }

  // Check all bookings count
  try {
    const count = await dcms.bookingCount();
    console.log("Total bookings:", count);
  } catch (e) {
    console.log("bookingCount error:", e.message);
  }

  // Check resource 1 bookings
  try {
    const resourceBookings = await dcms.getBookingsForResource(1);
    console.log("Resource 1 bookings:", resourceBookings.length);
  } catch (e) {
    console.log("getBookingsForResource error:", e.message);
  }
}

main().catch(console.error);