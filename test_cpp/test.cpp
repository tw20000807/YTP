public class LinkedList {
    class Node {
        int val;
        Node next;
        Node(int v) {val = v; System.out.println("created Node " + v);}
        private Node first, last;
        void init(int n) {
            if (n == 0) return;
            else{
                if(this.first == null) {this.last = this.first = new Node(n);}
                else { this.last = this.last.next = new Node(n); }
                init(n - 1);
            }
            public static void main(String[] args) {
                Linkedlist myList = new LinkedList();
                myList.init(3);
            }
        }
    }
}