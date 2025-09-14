# Spaced Repetition System - End-to-End Test Workflow

## Test Scenario: Complete Review Session

### Prerequisites
- User is logged in
- Has access to a folder with flashcards/materials
- Cards are enrolled in spaced repetition system

### Test Steps

1. **Start Review Session**
   - Navigate to folder with cards
   - Click "Start Review"
   - Verify review interface loads
   - Check study timer starts

2. **Test Card Review Flow**
   - Read the question/front content
   - Press `Space` to reveal answer
   - Grade the card using number keys (1-6)
   - Verify audio feedback plays
   - Check progress bar updates

3. **Test Navigation**
   - Use `←/→` arrows to navigate between cards
   - Test `S` key to skip cards
   - Verify card counter updates

4. **Test Analytics**
   - Press `A` to open analytics
   - Verify all metrics display correctly
   - Check grade distribution
   - Close analytics with `Escape` or close button

5. **Test Keyboard Shortcuts**
   - Press `?` to show help
   - Test all documented shortcuts
   - Verify help closes properly

6. **Complete Session**
   - Review multiple cards
   - Check session timer accuracy
   - Verify final statistics
   - Test session completion flow

### Expected Results
- ✅ All keyboard shortcuts work
- ✅ Analytics display accurate data
- ✅ Audio feedback works properly
- ✅ Timer and counters update correctly
- ✅ Visual feedback is smooth
- ✅ No console errors
- ✅ Responsive design works on different screen sizes

### Performance Checks
- Page loads within 2 seconds
- Keyboard shortcuts respond immediately
- Analytics data loads quickly
- No memory leaks during extended use
- Smooth animations and transitions

### Browser Compatibility
Test in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Error Scenarios
- Test with no internet connection
- Test with invalid card data
- Test rapid keyboard input
- Test during API failures
