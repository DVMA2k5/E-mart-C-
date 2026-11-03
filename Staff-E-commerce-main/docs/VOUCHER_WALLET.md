# Voucher ownership and distribution

## Admin

- **Public** appears in Nhận voucher; customers save it to their own wallet.
- **Only-code** is absent from discovery and the anonymous promotion feed. Customers enter the externally shared code in their wallet to claim it.
- **Sent to customer** is available for Public at creation only. It grants to the current active customer records, including scheduled vouchers. It does not send SMS or push notifications. Later customers claim manually.
- The claim capacity must cover every recipient when granting to all. Creation and granting commit together; insufficient capacity rejects the creation.
- Start date is the first day for receiving/using a voucher. Claim end date may precede the use expiry. Dates include the entire selected day in Vietnam.
- Each customer can claim once and successfully use once. Claim capacity counts all issued ownership records, including auto-grants and unused expired vouchers. It does not count completed purchases.
- Received vouchers reserve their allocated capacity permanently. Cancellation releases an order reservation, not the original ownership or claim capacity.
- Admin may disable a voucher. Once there are recipients, its code, visibility, discount terms and campaign type cannot change, and its use expiry cannot be shortened.

## Customer and order lifecycle

1. Claim Public by ID, or enter a code, through the authenticated claim endpoint.
2. A unique `(promotion_id, customer_id)` record is inserted. Concurrent claims are serialized with a SQL transaction lock before checking capacity.
3. Wallet lists only owned vouchers. Discovery uses claimed count to show availability; reaching capacity does not stop existing owners from using their vouchers.
4. POS and mobile checkout reserve the ownership record inside the order transaction. The same voucher cannot discount two pending orders.
5. Completion consumes the voucher once, increments completed use count and records redemption. POS cash completes immediately; online COD completes on delivery.
6. Cancelling an uncompleted order releases the reservation. Failed payment attempts leave the existing pending order retryable; cancel that order to release its voucher.
7. Used vouchers stay in Đã dùng even after the campaign expires. Unused vouchers whose use expiry has passed appear in Hết hạn. A reservation remains attached to an existing pending order until that order is completed/cancelled.

The invoice lifecycle hook synchronizes the voucher in the same transaction used by the order lifecycle. Refunding a completed purchase does not issue a second use.

## API

- `GET /api/storefront/vouchers/discover`: Public campaigns in their receiving window, including exhausted campaigns with their claimed status.
- `GET /api/storefront/vouchers`: the authenticated customer's wallet and ownership states.
- `POST /api/storefront/vouchers/claim`: exactly one of `{ promotionId }` or `{ code }`.
- `GET /api/storefront/promotions/history`: used and expired owned vouchers.
- Checkout validates ownership again on the server, independently of the displayed selection.

## Existing data and verification

The startup initializer adds the voucher fields and ownership table once. Old campaigns become Public with manual claiming. The former usage cap supplies their initial claim capacity; existing redemption history supplies prior ownership. No claim is invented for customers who never used an old voucher. Pending legacy redemptions become reservations, while successful legacy redemptions remain used. Historical completed redemption rows remain available to staff reports.

Run the SQL/HTTP integration suite against its automatically created temporary database:

```powershell
dotnet build Staff-E-commerce-main/tests/AuthorizationRegression/AuthorizationRegression.csproj --no-restore -o .tmp/voucher-tests -p:UseAppHost=false
dotnet .tmp/voucher-tests/AuthorizationRegression.dll C:/absolute/path/to/Staff-E-commerce-main/backend --voucher-only
```

The temporary database is deleted in `finally`; the application database is not used by the suite.
