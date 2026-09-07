import { sellerDisplayName, type SellerLegalInfo } from "@/lib/organizations/sellerLegal";

export function SellerLegalInfoCard({
  organizationName,
  seller,
  compact = false,
}: {
  organizationName: string;
  seller: SellerLegalInfo;
  compact?: boolean;
}) {
  const sellerName = sellerDisplayName(seller, organizationName);
  const hasPublishedDetails = Boolean(
    seller.seller_legal_name ||
      seller.seller_tax_id ||
      seller.seller_address ||
      seller.seller_contact_email ||
      seller.seller_country ||
      seller.seller_access_terms ||
      seller.seller_refund_terms
  );

  return (
    <section
      aria-labelledby="seller-information-title"
      className={compact ? "text-sm text-muted-foreground" : "rounded-lg border border-border p-5 text-sm"}
    >
      <h2 id="seller-information-title" className="font-semibold text-foreground">
        Información del vendedor
      </h2>
      <p className="mt-2 text-muted-foreground">
        Este curso lo vende {sellerName}.
      </p>

      {hasPublishedDetails ? (
        <dl className="mt-3 grid gap-2 text-muted-foreground">
          {seller.seller_tax_id ? (
            <div>
              <dt className="inline font-medium text-foreground">Identificador fiscal: </dt>
              <dd className="inline">{seller.seller_tax_id}</dd>
            </div>
          ) : null}
          {seller.seller_address ? (
            <div>
              <dt className="inline font-medium text-foreground">Domicilio: </dt>
              <dd className="inline whitespace-pre-line">{seller.seller_address}</dd>
            </div>
          ) : null}
          {seller.seller_country ? (
            <div>
              <dt className="inline font-medium text-foreground">País o territorio: </dt>
              <dd className="inline">{seller.seller_country}</dd>
            </div>
          ) : null}
          {seller.seller_contact_email ? (
            <div>
              <dt className="inline font-medium text-foreground">Contacto: </dt>
              <dd className="inline">
                <a
                  href={`mailto:${seller.seller_contact_email}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {seller.seller_contact_email}
                </a>
              </dd>
            </div>
          ) : null}
          {seller.seller_access_terms ? (
            <div>
              <dt className="font-medium text-foreground">Información de acceso</dt>
              <dd className="mt-1 whitespace-pre-line">{seller.seller_access_terms}</dd>
            </div>
          ) : null}
          {seller.seller_refund_terms ? (
            <div>
              <dt className="font-medium text-foreground">Información sobre cambios o reembolsos</dt>
              <dd className="mt-1 whitespace-pre-line">{seller.seller_refund_terms}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          La escuela aún no ha publicado datos de contacto del vendedor.
        </p>
      )}
    </section>
  );
}
