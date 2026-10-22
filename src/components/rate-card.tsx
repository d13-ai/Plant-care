import { Body, Button, Card, Heading, Row } from "@/components/ui";
import { RATING_ASK } from "@/domain/rating";
import { answerRating, openPlayListing } from "@/lib/rating";

/**
 * The one time the app asks for a rating: a note from the two of us, shown
 * on the greenhouse on a day nothing needs doing, once someone has logged
 * care on five different days (src/domain/rating.ts). Either button puts it
 * away for good.
 */
export function RateCard({ onAnswered }: { onAnswered: () => void }) {
  const answer = (choice: "rate" | "later") => {
    answerRating(choice);
    onAnswered();
    if (choice === "rate") openPlayListing();
  };
  return (
    <Card>
      <Heading>{RATING_ASK.title}</Heading>
      <Body small>{RATING_ASK.body}</Body>
      <Row>
        <Button title={RATING_ASK.rate} variant="primary" small onPress={() => answer("rate")} />
        <Button title={RATING_ASK.later} small onPress={() => answer("later")} />
      </Row>
    </Card>
  );
}

/** The same ask, always there in Account, for anyone who wants to rate
 *  without waiting to be asked. */
export function RateLink() {
  return (
    <Card>
      <Heading>{RATING_ASK.title}</Heading>
      <Body small muted>{RATING_ASK.body}</Body>
      <Row>
        <Button title={RATING_ASK.rate} small onPress={() => openPlayListing()} />
      </Row>
    </Card>
  );
}
