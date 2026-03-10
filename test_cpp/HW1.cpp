#include <iostream>
#include <string>

using namespace std;

// ==========================================
// Template Code 
// ==========================================

// Node structure for Circular Doubly-Linked List
struct Node {
    int data;
    Node* prev;
    Node* next;

    Node(int value) : data(value), prev(nullptr), next(nullptr) {}
};

class CircularLinkedList {
private:
    Node* head;   // Dummy head node

public:
    CircularLinkedList();
    ~CircularLinkedList();

    void insertAtBeginning(int value);
    void insertAtEnd(int value);
    void insertAfter(int target, int value);
    void insertBefore(int target, int value);
    void deleteNode(int value);
    void display() const;
    
    // Operator Overloading for concatenation (Deep Copy)
    CircularLinkedList operator+(const CircularLinkedList& other) const;
};

int main() {
    CircularLinkedList listA, listB;
    CircularLinkedList* currentList = &listA; 
    
    string command;
    while (cin >> command) {
        if (command == "switch") {
            char listName;
            cin >> listName;
            currentList = (listName == 'A') ? &listA : &listB;
        } 
        else if (command == "insertAtBeginning") {
            int val; cin >> val;
            currentList->insertAtBeginning(val);
        } 
        else if (command == "insertAtEnd") {
            int val; cin >> val;
            currentList->insertAtEnd(val);
        } 
        else if (command == "insertAfter") {
            int target, val; cin >> target >> val;
            currentList->insertAfter(target, val);
        } 
        else if (command == "insertBefore") {
            int target, val; cin >> target >> val;
            currentList->insertBefore(target, val);
        } 
        else if (command == "deleteNode") {
            int val; cin >> val;
            currentList->deleteNode(val);
        } 
        else if (command == "display") {
            currentList->display();
        } 
        else if (command == "concat") {
            CircularLinkedList listC = listA + listB;
            listC.display();
        }
    }
    return 0;
}

// Constructor: Initialize an empty list with a dummy head node.
CircularLinkedList::CircularLinkedList() {
    // TODO: Allocate memory for the dummy head node.
    // Hint: In an empty CDLL, where should the 'prev' and 'next' pointers of the head point to?
    head = new Node(0);
    head->next = head;
    head->prev = head;
}

// Destructor: Free the memory of all nodes (including the dummy head node).
CircularLinkedList::~CircularLinkedList() {
    // TODO: Traverse the list and use delete to free memory.
    // Hint: A circular list has no nullptr. What is your loop termination condition?
    Node *now = head->next;
    while(now != head){
        Node *tmp = now;
        now = now->next;
        delete tmp;
    }
}

// Insert a new node at the beginning (immediately after the dummy head).
void CircularLinkedList::insertAtBeginning(int value) {
    // TODO: Implement the insertion logic. Make sure to properly update the prev and next pointers.
    Node *cur = new Node(value);
    Node *a = head;
    Node *b = head->next;
    a->next = cur;
    b->prev = cur;
    cur->next = b;
    cur->prev = a;
}

// Insert a new node at the end of the list.
void CircularLinkedList::insertAtEnd(int value) {
    // TODO: Implement the insertion logic.
    // Hint: Leverage the circular and doubly-linked properties; you don't need O(N) time to find the tail!
    Node *cur = new Node(value);
    Node *a = head->prev;
    Node *b = head;
    a->next = cur;
    b->prev = cur;
    cur->next = b;
    cur->prev = a;
}

// Insert a new node immediately after the first node containing the target value.
void CircularLinkedList::insertAfter(int target, int value) {
    // TODO: Find the target node and insert the new node after it.
    // If the target is not found, print: cout << "Value " << target << " not found." << endl;
    Node *now = head->next;
    while(now != head && now->data != target){
        now = now->next;
    }
    if(now == head) cout << "Value " << target << " not found." << endl;
    else{
        Node *cur = new Node(value);
        Node *a = now;
        Node *b = now->next;
        a->next = cur;
        b->prev = cur;
        cur->next = b;
        cur->prev = a;
    }
}

// Insert a new node immediately before the first node containing the target value.
void CircularLinkedList::insertBefore(int target, int value) {
    // TODO: Find the target node and insert the new node before it.
    // If the target is not found, print: cout << "Value " << target << " not found." << endl;
    Node *now = head->next;
    while(now != head && now->data != target){
        now = now->next;
    }
    if(now == head) cout << "Value " << target << " not found." << endl;
    else{
        Node *cur = new Node(value);
        Node *a = now->prev;
        Node *b = now;
        a->next = cur;
        b->prev = cur;
        cur->next = b;
        cur->prev = a;
    }
}

// Delete the first node containing the target value.
void CircularLinkedList::deleteNode(int value) {
    // TODO: Find the target node, delete it, reconnect the surrounding nodes, and free the memory.
    // If the value is not found, print: cout << "Value " << value << " not found." << endl;
    Node *now = head->next;
    while(now != head && now->data != value){
        now = now->next;
    }
    if(now == head) cout << "Value " << value << " not found." << endl;
    else{
        Node *a = now->prev;
        Node *b = now->next;
        a->next = b;
        b->prev = a;
        delete now;
    }
}

// Print the list contents.
void CircularLinkedList::display() const {
    // TODO: Traverse the list from start to finish and print its contents in the format: "val1 -> val2 -> val3 -> HEAD"
    // Print a newline at the end. If the list is empty, just print "HEAD\n"
    Node *now = head->next;
    while(now != head){
        cout << now->data << " -> ";
        now = now->next;
    }
    cout << "HEAD" << endl;
}

// Operator Overloading: Concatenate two linked lists (Deep Copy).
CircularLinkedList CircularLinkedList::operator+(const CircularLinkedList& other) const {
    CircularLinkedList result;
    // TODO: Implement the logic for list_c = this + other.
    // 'result' must be a completely new list containing all elements from 'this' list followed by 'other' list.
    // Note: Do NOT modify the original structures of 'this' and 'other'.
    Node *now = head->next;
    while(now != head){
        result.insertAtEnd(now->data);
        now = now->next;
    }
    now = other.head->next;
    while(now != other.head){
        result.insertAtEnd(now->data);
        now = now->next;
    }
    
    return result;
}
/*
insertAtBeginning 20
insertAtEnd 40
insertBefore 20 10
insertAfter 20 30
switch B
insertAtEnd 50
insertAtEnd 60
concat
*/